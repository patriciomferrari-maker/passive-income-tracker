const fs = require('fs');
const fetch = require('node-fetch');

async function importTCBlue() {
    console.log('Reading TC Blue data from file...\n');

    const filePath = 'C:\\Users\\patri\\.gemini\\antigravity\\Bases\\TC Blue.txt';
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(1); // Skip header

    const records = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split('\t').map(p => p.trim());
        if (parts.length < 3) continue;

        const [dateStr, compraStr, ventaStr] = parts;

        // Parse DD/MM/YYYY to YYYY-MM-DD
        const [day, month, year] = dateStr.split('/');
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // Parse values (replace comma with dot)
        const buyRate = parseFloat(compraStr.replace(',', '.'));
        const sellRate = parseFloat(ventaStr.replace(',', '.'));

        if (!isNaN(buyRate) && !isNaN(sellRate) && year && month && day) {
            records.push({ date: isoDate, buyRate, sellRate });
        }
    }

    console.log(`Parsed ${records.length} total records`);

    // Sort by date
    records.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`Date range: ${records[0]?.date} to ${records[records.length - 1]?.date}`);
    console.log('');

    // Filter records before 2019-01-01 (missing in production)
    const missingRecords = records.filter(r => r.date < '2019-01-01');
    console.log(`Found ${missingRecords.length} missing records (before 2019-01-01)`);
    if (missingRecords.length > 0) {
        console.log(`Missing range: ${missingRecords[0]?.date} to ${missingRecords[missingRecords.length - 1]?.date}`);
    }
    console.log('');

    if (missingRecords.length === 0) {
        console.log('✅ No missing records to import!');
        return;
    }

    const PROD_URL = 'https://passive-income-tracker.vercel.app';
    const ADMIN_SECRET = 'mi-secreto-super-seguro-123';

    console.log('🚀 Importing missing TC Blue data to production...');
    console.log(`URL: ${PROD_URL}/api/admin/import-tc-blue`);
    console.log('');

    try {
        const res = await fetch(`${PROD_URL}/api/admin/import-tc-blue`, {
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

importTCBlue().catch(console.error);
