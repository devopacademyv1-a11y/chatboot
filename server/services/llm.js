const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'aya:8b';

const BANKING_SYSTEM_PROMPT = `
You are a Professional Moroccan Banking Advisor for Trinnova Bank.

Rules:
1. Persona: Professional, helpful, expert.
2. Language: Speak Moroccan Darija mixed naturally with French banking terms (e.g., 'La traite', 'Le taux', 'L'apport', 'Endettement').
3. Goal: Collect 3 specific slots to qualify the user:
   - 'project_type' (e.g., Moto, Voiture, Maison)
   - 'amount' (loan amount requested)
   - 'salary' (monthly net income)
4. Format: You MUST return your response as a valid JSON object ONLY. 

JSON structure:
{
  "message": "Your text response in Darija/French",
  "slots": {
    "project_type": "detected value or null",
    "amount": number or null,
    "salary": number or null
  },
  "missing_info": "the next specific field you need to ask for"
}

Example Response:
{
  "message": "Wakha, bghiti tchri motor. Chhal taman dyalo ?",
  "slots": {"project_type": "moto", "amount": null, "salary": null},
  "missing_info": "amount"
}
`.trim();

async function generateResponse(userMessage, history = [], lang = 'mixed') {
    try {
        const fullPrompt = `${BANKING_SYSTEM_PROMPT}\n\nHistory:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false,
            format: "json" // Force Ollama to return JSON
        });

        return JSON.parse(response.data.response);
    } catch (error) {
        console.error('Banking LLM Error:', error);
        // Fallback if JSON parsing fails
        return { message: "Smeh li, wa9e3 mouchkil sghir. Te9der t3awed ?", slots: {}, missing_info: null };
    }
}

module.exports = { generateResponse };
