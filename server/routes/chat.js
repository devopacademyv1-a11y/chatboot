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

/**
 * Streaming text chat (real-time tokens via SSE)
 */
router.post('/stream', async (req, res) => {
    const { message, history } = req.body;
    const { lang } = detectLanguage(message);
    await streamResponse(message, history || [], res);
});

/**
 * Standard text chat (structured JSON for slot-filling)
 */
router.post('/text', async (req, res) => {
    const { message, history } = req.body;
    try {
        const { lang } = detectLanguage(message);
        const aiData = await generateResponse(message, history || [], lang);
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
router.post('/voice', upload.single('audio'), async (req, res) => {
    const audioFile = req.file;
    const history = JSON.parse(req.body.history || '[]');
    try {
        const transcription = await transcribeAudio(audioFile.path);
        const { lang } = detectLanguage(transcription);
        const aiData = await generateResponse(transcription, history, lang);
        
        const audioOutFilename = `response_${Date.now()}.wav`;
        const audioOutPath = path.join(__dirname, '../temp', audioOutFilename);
        await generateSpeech(aiData.message, audioOutPath, lang);

        res.json({
            transcription,
            response: aiData.message,
            slots: aiData.slots,
            missing_info: aiData.missing_info,
            audioUrl: `/temp/${audioOutFilename}`,
            lang
        });
        fs.unlink(audioFile.path, () => {});
    } catch (error) {
        console.error('Voice Error:', error);
        res.status(500).json({ error: 'Failed to process voice' });
    }
});

module.exports = router;
