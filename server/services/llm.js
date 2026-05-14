const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

const EMPTY_SLOTS = {
    project_type: null,
    amount: null,
    salary: null
};

function mergeSlots(...slotSources) {
    return slotSources.reduce((merged, source) => {
        if (!source) return merged;

        return {
            project_type: source.project_type || merged.project_type,
            amount: Number(source.amount) || merged.amount,
            salary: Number(source.salary) || merged.salary
        };
    }, { ...EMPTY_SLOTS });
}

function normalizeText(text = '') {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectProjectType(message = '') {
    const text = normalizeText(message);

    if (/\b(auto|voiture|tomobile|tonobil|motor|moto|car)\b/.test(text)) return 'auto';
    if (/\b(immo|immobilier|dar|maison|appart|appartement|logement|studio)\b/.test(text)) return 'immo';
    if (/\b(conso|consommation|travaux|voyage|mariage|reparation|repair|flous)\b/.test(text)) return 'conso';

    return null;
}

function extractAmount(message = '') {
    const text = normalizeText(message).replace(/,/g, '.');
    const millionMatch = text.match(/(\d+(?:\.\d+)?)\s*(mlyoun|million|mليون)/);
    if (millionMatch) return Math.round(Number(millionMatch[1]) * 100000);

    const thousandMatch = text.match(/(\d+(?:\.\d+)?)\s*(k|mille|alf)\b/);
    if (thousandMatch) return Math.round(Number(thousandMatch[1]) * 1000);

    const numberMatch = text.match(/\b\d{3,9}\b/);
    return numberMatch ? Number(numberMatch[0]) : null;
}

function formatDh(value) {
    return `${Number(value).toLocaleString('fr-FR')} DH`;
}

function buildQualificationResponse(message, providedSlots = EMPTY_SLOTS) {
    const slots = mergeSlots(providedSlots);
    const projectType = detectProjectType(message);
    const numericValue = extractAmount(message);

    if (projectType) slots.project_type = projectType;

    if (numericValue) {
        if (!slots.amount) {
            slots.amount = numericValue;
        } else if (!slots.salary) {
            slots.salary = numericValue;
        }
    }

    if (!slots.project_type) {
        return {
            message: 'Salam! Chnou houwa el machrou3 dialk: Crédit Auto, Immobilier, ou Consommation?',
            slots,
            missing_info: 'project_type'
        };
    }

    if (!slots.amount) {
        const projectLabel = slots.project_type === 'immo' ? 'had dar/appartement' : slots.project_type === 'auto' ? 'had tomobile' : 'had projet';
        return {
            message: `Mebrouk! Chhal taman dial ${projectLabel} li bghiti t-financi?`,
            slots,
            missing_info: 'amount'
        };
    }

    if (!slots.salary) {
        return {
            message: `Wakha, montant ${formatDh(slots.amount)}. Bach n-calculiw la capacite d'emprunt, chhal salaire net dialk f chher?`,
            slots,
            missing_info: 'salary'
        };
    }

    const monthlyPayment = (slots.amount * 1.1) / 60;
    const debtRatio = Math.round((monthlyPayment / slots.salary) * 100);
    const eligible = debtRatio <= 40 && slots.salary >= 3000;

    return {
        message: eligible
            ? `Mzyan, salaire ${formatDh(slots.salary)} w taux d'endettement taqriban ${debtRatio}%. Dossier dialk eligible. Nbdaw l-ijraat?`
            : `Smeh li, b had montant taux d'endettement ghadi ykoun ${debtRatio}%, w khaso ybqa hta 40%. T9der tna9es montant credit ola tzid apport?`,
        slots,
        missing_info: null
    };
}

function writeSse(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Fast random line picker for massive JSONL files
function getRandomExamples(filePath, count = 2) {
    try {
        if (!fs.existsSync(filePath)) return "";
        const data = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.length > 10);
        if (data.length < 5) return "";
        
        let shuffled = [...data].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map(line => {
            const json = JSON.parse(line);
            return `User: "${json.user}"\nAssistant: ${JSON.stringify(json.assistant_json)}`;
        }).join('\n\n');
    } catch (e) { return ""; }
}

const BANKING_SYSTEM_PROMPT = `
You are a STRICTOR Moroccan Banking Advisor.
FLOW RULES:
1. FIRST: Identify Project (Auto, Immo, Conso).
2. SECOND: Ask for Amount.
3. THIRD: Ask for Salary.
4. NEVER skip steps. NEVER ask for salary first.
Speak in Darija/French. Output ONLY JSON.
`.trim();

async function generateResponse(userMessage, history = [], lang = 'mixed', currentSlots = EMPTY_SLOTS) {
    return buildQualificationResponse(userMessage, currentSlots);
}

async function streamResponse(userMessage, history = [], res, currentSlots = EMPTY_SLOTS) {
    const qualification = buildQualificationResponse(userMessage, currentSlots);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    writeSse(res, { token: qualification.message });
    writeSse(res, { done: true, full: JSON.stringify(qualification), data: qualification });
    res.end();
}

async function streamOllamaResponse(userMessage, history = [], res) {
    const dataPath = path.join(__dirname, '../mega_dataset_100k.jsonl');
    const dynamicExamples = getRandomExamples(dataPath);
    
    const dynamicPrompt = `${BANKING_SYSTEM_PROMPT}\n\nLearning Patterns:\n${dynamicExamples}\n\nHistory:\n${history.slice(-4).map(m => m.role + ": " + m.content).join('\n')}\nUser: "${userMessage}"\nAssistant:`;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('X-Accel-Buffering', 'no');
    
    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: dynamicPrompt,
            stream: true,
            options: { 
                temperature: 0, // CRITICAL: Stop hallucinations
                seed: 42,
                stop: ["User:", "Assistant:"] 
            }
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
    } catch (err) { res.end(); }
}

module.exports = { generateResponse, streamResponse, streamOllamaResponse };
