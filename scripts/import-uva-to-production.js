const fs = require('fs');
const fetch = require('node-fetch');

async function importUVAToProduction() {
    console.log('Reading UVA data from file...\n');

    const filePath = 'C:\\Users\\patri\\.gemini\\antigravity\\Bases\\Valor UVA.txt';
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(1); // Skip header

    const records = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split('\t').map(p => p.trim());
        if (parts.length < 2) continue;

        const [dateStr, valueStr] = parts;

        // Parse DD/MM/YYYY to YYYY-MM-DD
        const [day, month, year] = dateStr.split('/');
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // Parse value (replace comma with dot)
        const value = parseFloat(valueStr.replace(',', '.'));

        if (!isNaN(value) && year && month && day) {
            records.push({ date: isoDate, value });
        }
    }

    console.log(`Parsed ${records.length} total records`);
    console.log('');

    // Filter records before 2019-01-01 (missing in production)
    const missingRecords = records.filter(r => r.date < '2019-01-01');
    console.log(`Found ${missingRecords.length} missing records (before 2019-01-01)`);
    console.log(`Date range: ${missingRecords[0]?.date} to ${missingRecords[missingRecords.length - 1]?.date}`);
    console.log('');

    const PROD_URL = 'https://passive-income-tracker.vercel.app';
    const ADMIN_SECRET = 'mi-secreto-super-seguro-123';

    console.log('🚀 Importing to production...');
    console.log(`URL: ${PROD_URL}/api/admin/import-uva`);
    console.log('');

    try {
        const res = await fetch(`${PROD_URL}/api/admin/import-uva`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_SECRET}`
            },
            body: JSON.stringify({ records: missingRecords })
        });

        const result = await res.json();

        if (res.ok) {
            console.log('✅ Import successful!');
            console.log(`   - Imported: ${result.imported}`);
            console.log(`   - Skipped: ${result.skipped}`);
            console.log(`   - Errors: ${result.errors}`);
        } else {
            console.error('❌ Import failed:', result.error);
            console.error('Response status:', res.status);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

importUVAToProduction().catch(console.error);
