const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function bulkGenerate() {
    let allConversations = [];
    const TOTAL_BATCHES = 50; // 50 batches * 20 conversations = 1000
    
    console.log(`🚀 Starting Bulk Generation (Target: 1000 Conversations)`);

    for (let i = 1; i <= TOTAL_BATCHES; i++) {
        console.log(`📦 Batch ${i}/${TOTAL_BATCHES} in progress...`);
        
        const prompt = `Generate 20 unique, realistic banking conversations in Moroccan Darija/French.
        Scenarios: ${i % 3 === 0 ? 'Home Loans' : i % 3 === 1 ? 'Car Loans' : 'Personal Credit'}.
        Vary the user's personality: some are polite, some are direct, some use numbers like 10k, some use "mlyoun".
        
        Return ONLY a JSON array of objects:
        {"user": "...", "assistant_json": {"message": "...", "slots": {"project_type": "...", "amount": 0, "salary": 0}, "missing_info": "..."}}`;

        try {
            const response = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 4000,
                messages: [{ role: "user", content: prompt }],
            });

            const rawContent = response.content[0].text;
            // Clean the response if it has markdown code blocks
            const jsonStr = rawContent.replace(/```json|```/g, '').trim();
            const batch = JSON.parse(jsonStr);
            
            allConversations = allConversations.concat(batch);
            
            // Save progress every batch
            fs.writeFileSync('darija_banking_1000.json', JSON.stringify(allConversations, null, 2));
            console.log(`✅ Saved. Total conversations so far: ${allConversations.length}`);
            
            // Short delay to avoid rate limits
            await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
            console.error(`❌ Error in batch ${i}:`, error.message);
            if (error.message.includes('rate_limit')) {
                console.log("⏸ Rate limit hit. Waiting 30 seconds...");
                await new Promise(r => setTimeout(r, 30000));
                i--; // Retry this batch
            }
        }
    }
    console.log("🏁 FINISHED! 1000 conversations saved to darija_banking_1000.json");
}

bulkGenerate();
