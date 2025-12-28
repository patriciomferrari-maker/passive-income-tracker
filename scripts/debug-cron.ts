import fs from 'fs';
import path from 'path';
import { runDailyMaintenance } from '../app/lib/cron-service';

async function main() {
    console.log('Starting debug run...');

    try {
        const envPath = path.resolve(process.cwd(), '.env');
        console.log('Reading .env from:', envPath);
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            const keys = lines.map(l => l.split('=')[0].trim()).filter(k => k && !k.startsWith('#'));
            console.log('Keys in .env:', keys.join(', '));
            console.log('RESEND_API_KEY present in .env:', keys.includes('RESEND_API_KEY'));
        } else {
            console.log('.env file not found');
        }
    } catch (e) {
        console.error('Error reading .env:', e);
    }

    // Attempt to load it into process.env manually since dotenv might be quirky
    // (This is a hack for debugging)

    const userId = 'cmixq96ww0000l8pp4w1zu2cy';
    // const result = await runDailyMaintenance(true, userId);
    // console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
