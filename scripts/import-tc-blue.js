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
        const compra = parseFloat(compraStr.replace(',', '.'));
        const venta = parseFloat(ventaStr.replace(',', '.'));

        // Use average of buy and sell rates
        const value = (compra + venta) / 2;

        if (!isNaN(value) && year && month && day) {
            records.push({ date: isoDate, sellRate: venta, buyRate: compra });
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
    console.log(`URL: ${PROD_URL}/api/admin/economic`);
    console.log('');

    try {
        // Import in batches of 100 to avoid timeout
        const batchSize = 100;
        let imported = 0;

        for (let i = 0; i < missingRecords.length; i += batchSize) {
            const batch = missingRecords.slice(i, i + batchSize);

            console.log(`Importing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(missingRecords.length / batchSize)} (${batch.length} records)...`);

            const res = await fetch(`${PROD_URL}/api/admin/economic`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ADMIN_SECRET}`
                },
                body: JSON.stringify({ bulk: batch })
            });

            const result = await res.json();

            if (res.ok) {
                imported += batch.length;
                console.log(`  ✅ Batch imported successfully`);
            } else {
                console.error(`  ❌ Batch failed:`, result.error);
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('');
        console.log(`✅ Import complete! Imported ${imported} records`);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

importTCBlue().catch(console.error);
