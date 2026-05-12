const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'aya:8b';

/**
 * Build system prompt based on detected/preferred language
 */
function buildSystemPrompt(lang) {
    const langInstruction = {
        darija: `IMPORTANT: The user is speaking Moroccan Darija. Reply ONLY in Darija (written in Latin script as Moroccans typically do on WhatsApp, e.g., "labas", "wakha", "bghit"). Do NOT reply in Arabic script.`,
        french: `IMPORTANT: The user is speaking French. Reply ONLY in formal, professional French.`,
        mixed: `The user may mix Darija and French ("Frarija"). Reply naturally in the same mixed style they use, as a Moroccan would.`,
    };

    return `
Tu es "Trinnova AI", un assistant intelligent et chaleureux conçu pour les utilisateurs marocains sur WhatsApp.

${langInstruction[lang] || langInstruction.mixed}

Règles générales:
- Réponds de manière concise (2-3 phrases max) pour les messages vocaux.
- Sois professionnel mais accessible et naturel.
- Si l'utilisateur écrit "français" ou "darija", bascule immédiatement vers cette langue.
- Joins TOUJOURS un bref résumé textuel même si c'est un message vocal.
- Tu es uniquement "Trinnova AI".
    `.trim();
}

/**
 * Generate AI response using local Ollama (Aya)
 * @param {string} userMessage
 * @param {Array} history - Array of { role, content } from MongoDB
 * @param {string} lang - 'darija' | 'french' | 'mixed'
 */
async function generateResponse(userMessage, history = [], lang = 'mixed') {
    try {
        const systemPrompt = buildSystemPrompt(lang);
        
        // Format prompt for Aya (usually follows ChatML or specific template)
        const fullPrompt = `${systemPrompt}\n\nHistory:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false,
        });

        return response.data.response;
    } catch (error) {
        console.error('Local LLM Error (Ollama):', error);
        throw error;
    }
}

module.exports = { generateResponse };
