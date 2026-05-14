const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('../services/stt');
const { generateResponse, streamResponse } = require('../services/llm');
const { generateSpeech } = require('../services/tts');
const { detectLanguage } = require('../utils/detectLanguage');

const upload = multer({ dest: 'temp/' });

router.post('/tts', async (req, res) => {
    try {
        const { text, lang } = req.body;
        const audioUrl = await generateSpeech(text, lang || 'fr');
        res.json({ audioUrl });
    } catch (e) {
        res.status(500).json({ error: 'TTS Failed' });
    }
});

/**
 * Streaming text chat (real-time tokens via SSE)
 */
router.post('/stream', async (req, res) => {
    const { message, history, slots } = req.body;
    const { lang } = detectLanguage(message);
    await streamResponse(message, history || [], res, slots || {});
});

/**
 * Standard text chat (structured JSON for slot-filling)
 */
router.post('/text', async (req, res) => {
    const { message, history, slots } = req.body;
    try {
        const { lang } = detectLanguage(message);
        const aiData = await generateResponse(message, history || [], lang, slots || {});
        res.json({ 
            response: aiData.message,
            slots: aiData.slots,
            missing_info: aiData.missing_info,
            lang 
        });
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ error: 'Failed to process lead' });
    }
});

/**
 * Voice lead qualification
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const transcription = await transcribeAudio(req.file.path);
        res.json({ transcription });
    } catch (e) {
        res.status(500).json({ error: 'Transcription Failed' });
    }
});

module.exports = router;
