const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const { transcribeAudio } = require('../services/stt');
const { generateResponse } = require('../services/llm');
const { generateSpeech } = require('../services/tts');
const { detectLanguage } = require('../utils/detectLanguage');
const Conversation = require('../models/Conversation');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// ─── Webhook Verification ────────────────────────────────────────────────────
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified by Meta');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// ─── Incoming Message Handler ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const body = req.body;

    // Always ACK immediately to avoid Meta retries
    res.sendStatus(200);

    if (!body.object) return;
    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.[0]) return;

    const message = value.messages[0];
    const from = message.from;
    const msgType = message.type;

    try {
        let userText = '';
        let isVoice = false;

        // ── Step 1: Extract text ──────────────────────────────────────────────
        if (msgType === 'text') {
            userText = message.text.body;
        } else if (msgType === 'audio') {
            console.log(`🎙️  Voice message from ${from}`);
            userText = await handleVoiceDownloadAndTranscribe(message.audio.id);
            isVoice = true;
        } else {
            // Unsupported type
            return;
        }

        if (!userText.trim()) return;
        console.log(`💬 [${from}] "${userText}"`);

        // ── Step 2: Load or create conversation session ───────────────────────
        let conversation = await Conversation.findOne({ whatsappId: from });
        if (!conversation) {
            conversation = new Conversation({ whatsappId: from, phone: from, messages: [] });
        }

        // ── Step 3: Language detection & override ─────────────────────────────
        const { lang, override } = detectLanguage(userText);
        if (override) conversation.preferredLang = lang;
        const effectiveLang = conversation.preferredLang === 'auto' ? lang : conversation.preferredLang;

        // ── Step 4: Generate AI response ──────────────────────────────────────
        const aiText = await generateResponse(userText, conversation.messages, effectiveLang);
        console.log(`🤖 Response: "${aiText}"`);

        // ── Step 5: Save messages to MongoDB ──────────────────────────────────
        conversation.messages.push({ role: 'user', content: userText, language: effectiveLang, isVoice });
        conversation.messages.push({ role: 'assistant', content: aiText, language: effectiveLang, isVoice: true });
        await conversation.save();

        // ── Step 6: Send text reply ───────────────────────────────────────────
        await sendTextMessage(from, aiText);

        // ── Step 7: Generate & send voice reply ───────────────────────────────
        const audioPath = path.join(TEMP_DIR, `resp_${Date.now()}.mp3`);
        await generateSpeech(aiText, audioPath);
        await sendAudioMessage(from, audioPath);

        // Cleanup temp file
        fs.unlink(audioPath, () => {});

    } catch (err) {
        console.error('❌ Processing error:', err.message || err);
    }
});

// ─── Admin: Get all conversations ────────────────────────────────────────────
router.get('/conversations', async (req, res) => {
    try {
        const convs = await Conversation.find({}, { messages: { $slice: -5 } })
            .sort({ lastActivity: -1 })
            .limit(50);
        res.json(convs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function handleVoiceDownloadAndTranscribe(audioId) {
    // 1. Get media URL
    const mediaRes = await axios.get(`https://graph.facebook.com/v18.0/${audioId}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const mediaUrl = mediaRes.data.url;

    // 2. Download audio
    const filePath = path.join(TEMP_DIR, `${audioId}.ogg`);
    const audioStream = await axios({ method: 'get', url: mediaUrl, headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }, responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    audioStream.data.pipe(writer);
    await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });

    // 3. Transcribe with Whisper
    const text = await transcribeAudio(filePath);
    fs.unlink(filePath, () => {});
    return text;
}

async function sendTextMessage(to, text) {
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: 'whatsapp',
        to,
        text: { body: text }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } });
}

async function sendAudioMessage(to, audioPath) {
    // 1. Upload audio to Meta
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'audio/mpeg');
    form.append('file', fs.createReadStream(audioPath), { filename: 'response.mp3', contentType: 'audio/mpeg' });

    const uploadRes = await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/media`, form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const mediaId = uploadRes.data.id;

    // 2. Send audio message
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: 'whatsapp',
        to,
        type: 'audio',
        audio: { id: mediaId }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } });
}

module.exports = router;
