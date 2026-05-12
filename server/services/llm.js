const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const BANKING_SYSTEM_PROMPT = `
You are a professional Moroccan Banking Advisor for Trinnova Bank.
Rules:
1. Speak Moroccan Darija mixed with French banking terms.
2. Your goal: collect project_type (Auto/Immo/Conso), amount, and salary.
3. Be concise (2-3 sentences max).
4. Return ONLY valid JSON:
{"message":"your response","slots":{"project_type":null,"amount":null,"salary":null},"missing_info":"next field to ask"}
5. Never break character. You are a banker from Casablanca.
`.trim();

async function generateResponse(userMessage, history = [], lang = 'mixed') {
    try {
        const fullPrompt = `${BANKING_SYSTEM_PROMPT}\n\nHistory:\n${history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false,
            format: "json",
            options: {
                num_predict: 200,   // Limit token output for speed
                temperature: 0.7,
                num_thread: 4       // Use all available CPU threads
            }
        }, { timeout: 60000 });

        return JSON.parse(response.data.response);
    } catch (error) {
        console.error('Banking LLM Error:', error.message);
        return { 
            message: "Smeh li, wa9e3 mouchkil sghir. Te9der t3awed daba?", 
            slots: { project_type: null, amount: null, salary: null }, 
            missing_info: null 
        };
    }
}

// Streaming version for real-time token output
async function streamResponse(userMessage, history = [], res) {
    const fullPrompt = `${BANKING_SYSTEM_PROMPT}\n\nHistory:\n${history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: true,
            options: { num_predict: 250, temperature: 0.7, num_thread: 4 }
        }, { responseType: 'stream', timeout: 60000 });

        let fullText = '';
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        fullText += json.response;
                        res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
                    }
                    if (json.done) {
                        res.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`);
                        res.end();
                    }
                } catch (e) { /* skip */ }
            }
        });

        response.data.on('error', () => {
            res.write(`data: ${JSON.stringify({ error: true })}\n\n`);
            res.end();
        });
    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: true })}\n\n`);
        res.end();
    }
}

module.exports = { generateResponse, streamResponse };
