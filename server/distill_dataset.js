const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
require('dotenv').config();

// Use environment variable for security
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateDataset() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("❌ ANTHROPIC_API_KEY missing in .env");
        return;
    }
    
    console.log("🚀 Generation started...");
    
    const prompt = `You are a Moroccan Banking Expert... (Omitted for brevity)`;

    try {
        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4000,
            messages: [{ role: "user", content: prompt }],
        });

        const data = response.content[0].text;
        fs.writeFileSync('darija_banking_dataset.json', data);
        console.log("✅ DONE!");
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

generateDataset();
