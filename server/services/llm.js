const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

// Load our "Gold Standard" dataset
let dataset = [];
try {
    const dataPath = path.join(__dirname, '../darija_banking_1000.json');
    if (fs.existsSync(dataPath)) {
        dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log(`✅ Brain loaded: ${dataset.length} banking patterns ready.`);
    }
} catch (e) {
    console.error("❌ Failed to load dataset:", e.message);
}

const BANKING_SYSTEM_PROMPT = `
You are a Professional Moroccan Banking Advisor for Trinnova Bank.
Speak ONLY in a mix of Moroccan Darija (Arabizi) and French banking terms.

Current Goal: Collect project_type, amount, and salary.
Output Format: Return ONLY JSON.
`.trim();

function getDynamicExamples() {
    if (dataset.length === 0) return "";
    // Pick 3 random examples to keep the prompt fresh and diverse
    const shuffled = [...dataset].sort(() => 0.5 - Math.random());
    const examples = shuffled.slice(0, 2);
    
    return examples.map(ex => `
User: "${ex.user}"
Assistant: ${JSON.stringify(ex.assistant_json)}
`).join('\n');
}

async function generateResponse(userMessage, history = [], lang = 'mixed') {
    try {
        const dynamicPrompt = `${BANKING_SYSTEM_PROMPT}\n\nLearning Patterns:\n${getDynamicExamples()}\n\nHistory:\n${history.slice(-4).map(m => m.role + ": " + m.content).join('\n')}\nUser: "${userMessage}"\nAssistant:`;

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: dynamicPrompt,
            stream: false,
            format: "json",
            options: { temperature: 0.4 }
        });

        return JSON.parse(response.data.response);
    } catch (error) {
        return { message: "Smeh li, mouchkil f l-connexion.", slots: {}, missing_info: null };
    }
}

async function streamResponse(userMessage, history = [], res) {
    const dynamicPrompt = `${BANKING_SYSTEM_PROMPT}\n\nLearning Patterns:\n${getDynamicExamples()}\n\nHistory:\n${history.slice(-4).map(m => m.role + ": " + m.content).join('\n')}\nUser: "${userMessage}"\nAssistant:`;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // CRITICAL: Fixes Nginx buffering
    
    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: dynamicPrompt,
            stream: true,
            options: { temperature: 0.4 }
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
