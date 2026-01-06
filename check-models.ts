
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('No API key found in .env');
    process.exit(1);
}

async function listModels() {
    console.log('Checking models with API key:', apiKey.substring(0, 5) + '...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Error fetching models:', data);
            return;
        }

        console.log('Available Models:');
        if (data.models) {
            data.models.forEach((model: any) => {
                const isGemini = model.name.includes('gemini');
                if (isGemini) {
                    console.log(`- ${model.name} (${model.displayName})`);
                    console.log(`  Supported: ${model.supportedGenerationMethods.join(', ')}`);
                }
            });
        } else {
            console.log('No models found in response:', data);
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

listModels();
