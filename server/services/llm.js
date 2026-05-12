const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const BANKING_SYSTEM_PROMPT = `
You are a Professional Moroccan Banking Advisor for Trinnova Bank.
Speak ONLY Moroccan Darija + French banking terms.

Current Goal: Collect project_type, amount, salary to qualify the lead.

Output Format (STRICT JSON):
{"message": "string", "slots": {"project_type": "string", "amount": number, "salary": number}, "missing_info": "string"}
`.trim();

async function generateResponse(userMessage, history = [], lang = 'mixed') {
    try {
        // Build a clean history for Qwen
        let conversation = history.slice(-4).map(m => `<|im_start|>${m.role}\n${m.content}<|im_end|>`).join('\n');
        
        const fullPrompt = `<|im_start|>system\n${BANKING_SYSTEM_PROMPT}<|im_end|>\n${conversation}\n<|im_start|>user\n${userMessage}<|im_end|>\n<|im_start|>assistant\n`;

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false,
            format: "json",
            options: { stop: ["<|im_end|>", "<|im_start|>"], temperature: 0.4 }
        });

        return JSON.parse(response.data.response);
    } catch (error) {
        return { message: "Smeh li, t-mecha l-connexion. T9der t3awed?", slots: {}, missing_info: null };
    }
}

async function streamResponse(userMessage, history = [], res) {
    let conversation = history.slice(-4).map(m => `<|im_start|>${m.role}\n${m.content}<|im_end|>`).join('\n');
    const fullPrompt = `<|im_start|>system\n${BANKING_SYSTEM_PROMPT}<|im_end|>\n${conversation}\n<|im_start|>user\n${userMessage}<|im_end|>\n<|im_start|>assistant\n`;
    
    res.setHeader('Content-Type', 'text/event-stream');
    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: true,
            options: { stop: ["<|im_end|>", "<|im_start|>"], temperature: 0.4 }
        }, { responseType: 'stream' });

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
                } catch (e) {}
            }
        });
    } catch (err) {
        res.end();
    }
}

module.exports = { generateResponse, streamResponse };
