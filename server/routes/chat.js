const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('../services/stt');
const { generateResponse } = require('../services/llm');
const { generateSpeech } = require('../services/tts');
const { detectLanguage } = require('../utils/detectLanguage');

const upload = multer({ dest: 'temp/' });

/**
 * Handle Text Chat
 */
router.post('/text', async (req, res) => {
    const { message, history } = req.body;

    try {
        const { lang } = detectLanguage(message);
        const aiResponse = await generateResponse(message, history, lang);
        
        res.json({ 
            response: aiResponse,
            lang: lang 
        });
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

/**
 * Handle Voice Chat
 */
router.post('/voice', upload.single('audio'), async (req, res) => {
    const audioFile = req.file;
    const history = JSON.parse(req.body.history || '[]');

    try {
        // 1. Transcribe
        const transcription = await transcribeAudio(audioFile.path);
        
        // 2. Language Detection
        const { lang } = detectLanguage(transcription);
        
        // 3. AI Response
        const aiResponse = await generateResponse(transcription, history, lang);
        
        // 4. TTS (Local)
        const audioOutFilename = `response_${Date.now()}.wav`;
        const audioOutPath = path.join(__dirname, '../temp', audioOutFilename);
        await generateSpeech(aiResponse, audioOutPath, lang);

        res.json({
            transcription,
            response: aiResponse,
            audioUrl: `/temp/${audioOutFilename}`,
            lang: lang
        });

        // Cleanup input file
        fs.unlink(audioFile.path, () => {});
    } catch (error) {
        console.error('Voice Chat Error:', error);
        res.status(500).json({ error: 'Failed to process voice message' });
    }
});

module.exports = router;
