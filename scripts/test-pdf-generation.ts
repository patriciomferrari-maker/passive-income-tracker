import { config } from 'dotenv';
import path from 'path';

// Load .env
config({ path: path.resolve(process.cwd(), '.env') });

async function testPdfGeneration() {
    console.log('=== TESTING PDF GENERATION ===');
    console.log('Environment:');
    console.log('- CRON_SECRET:', process.env.CRON_SECRET ? 'SET' : 'MISSING');
    console.log('- NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('- NODE_ENV:', process.env.NODE_ENV);

    // Import after env is loaded
    const { generateDashboardPdf } = await import('../app/lib/pdf-capture');

    try {
        console.log('\nGenerating Rentals PDF...');
        const userId = 'cmixpqcnk00003mnmljva12cg'; // Your user ID
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const secret = process.env.CRON_SECRET!;

        const pdfBuffer = await generateDashboardPdf(userId, 'rentals', baseUrl, secret);

        console.log('\n✅ PDF Generated Successfully!');
        console.log('- Size:', pdfBuffer.length, 'bytes');
        console.log('- Size (KB):', (pdfBuffer.length / 1024).toFixed(2), 'KB');

        // Save to file for inspection
        const fs = await import('fs');
        const outputPath = path.join(process.cwd(), 'test-rentals.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log('- Saved to:', outputPath);

    } catch (error) {
        console.error('\n❌ PDF Generation Failed:');
        console.error(error);
    }
}

testPdfGeneration();
