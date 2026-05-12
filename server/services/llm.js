const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const BANKING_SYSTEM_PROMPT = `
You are a Professional Moroccan Banking Advisor for Trinnova Bank in Casablanca.

Rules:
1. Persona: Professional but local.
2. Language: YOU MUST USE MOROCCAN DARIJA ONLY. Use Arabizi (Latin characters like 3, 7, 9) if the user uses them. NEVER USE MODERN STANDARD ARABIC (FOSHA).
3. Mixing: Mix naturally with French banking terms (e.g., 'La traite', 'Dossier', 'Apport', 'Taux').
4. Goal: Collect 3 slots: project_type, amount, salary.
5. Format: Return ONLY valid JSON.

Examples of your style:
- "Wakha a sidi, chhal taman dial l-motor li bghiti tchri?"
- "Khassni n3ref chhal la traite li 9der tkhless f ch-chher. Chhal houwa el-salaire dialk?"

JSON Output format:
{"message": "Your response in Darija/French", "slots": {"project_type": "auto/immo/conso", "amount": 1000, "salary": 5000}, "missing_info": "salary"}
`.trim();

async function generateResponse(userMessage, history = [], lang = 'mixed') {
    try {
        const fullPrompt = `${BANKING_SYSTEM_PROMPT}\n\nHistory:\n${history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false,
            format: "json",
            options: { num_predict: 150, temperature: 0.6, num_thread: 4 }
        });

        return JSON.parse(response.data.response);
    } catch (error) {
        return { message: "Smeh li, t-mecha l-connexion. T9der t3awed?", slots: {}, missing_info: null };
    }
}

async function streamResponse(userMessage, history = [], res) {
    const fullPrompt = `${BANKING_SYSTEM_PROMPT}\n\nHistory:\n${history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;
    res.setHeader('Content-Type', 'text/event-stream');
    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: true,
            options: { num_predict: 150, temperature: 0.6, num_thread: 4 }
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
