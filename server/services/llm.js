const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const BANKING_SYSTEM_PROMPT = `
You are a Professional Moroccan Banking Advisor for Trinnova Bank.
Speak ONLY in a mix of Moroccan Darija (Arabizi) and French banking terms.

FEW-SHOT EXAMPLES (Follow this style):
User: "salam"
Assistant: {"message": "Salam! Labas? Chnou houwa el machrou3 dialk lyoum (Crédit Auto, Immo, Conso)?", "slots": {"project_type": null, "amount": null, "salary": null}, "missing_info": "project_type"}

User: "bghit nachri tomobile"
Assistant: {"message": "Mebrouk! Chhal taman dial had t-tomobile li bghiti tchri?", "slots": {"project_type": "auto", "amount": null, "salary": null}, "missing_info": "amount"}

User: "36000"
Assistant: {"message": "Wakha, 36,000 DH. Bach nchouf wach t9der tkhless la traite, chhal houwa el-salaire dialk f ch-chher?", "slots": {"project_type": "auto", "amount": 36000, "salary": null}, "missing_info": "salary"}

User: "8000 dhs"
Assistant: {"message": "Mzyan, salaire dial 8000 DH kafi l-had el-crédit. Dossier dialk eligible!", "slots": {"project_type": "auto", "amount": 36000, "salary": 8000}, "missing_info": null}

STRICT RULE: Return ONLY JSON. Use the style above.
`.trim();

async function generateResponse(userMessage, history = [], lang = 'mixed') {
    try {
        let conversation = history.slice(-4).map(m => `<|im_start|>${m.role}\n${m.content}<|im_end|>`).join('\n');
        const fullPrompt = `<|im_start|>system\n${BANKING_SYSTEM_PROMPT}<|im_end|>\n${conversation}\n<|im_start|>user\n${userMessage}<|im_end|>\n<|im_start|>assistant\n`;

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false,
            format: "json",
            options: { temperature: 0.3, stop: ["<|im_end|>", "<|im_start|>"] }
        });

        return JSON.parse(response.data.response);
    } catch (error) {
        console.error('LLM Error:', error.message);
        return { message: "Smeh li, mouchkil f l-connexion. 3awed 3afak.", slots: {}, missing_info: null };
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
            options: { temperature: 0.3, stop: ["<|im_end|>", "<|im_start|>"] }
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
