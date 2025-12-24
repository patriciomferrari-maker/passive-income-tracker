const fs = require('fs');
const fetch = require('node-fetch');

async function importUVAData() {
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

    console.log(`Parsed ${records.length} records`);
    console.log('First 3:', records.slice(0, 3));
    console.log('Last 3:', records.slice(-3));
    console.log('');

    // Filter records before 2019-01-01 (missing in production)
    const missingRecords = records.filter(r => r.date < '2019-01-01');
    console.log(`Found ${missingRecords.length} records before 2019-01-01`);
    console.log('Date range:', missingRecords[0]?.date, 'to', missingRecords[missingRecords.length - 1]?.date);
    console.log('');

    // Prompt user for confirmation
    console.log('Ready to import to production.');
    console.log('This will add missing UVA data from 2016-03 to 2018-12.');
    console.log('');
    console.log('To proceed, uncomment the import code below and run again.');

    /*
    // UNCOMMENT THIS BLOCK TO ACTUALLY IMPORT
    console.log('Importing to production...');
    const PROD_URL = 'https://your-production-url.vercel.app';
    
    let imported = 0;
    for (const record of missingRecords) {
        try {
            const res = await fetch(`${PROD_URL}/api/admin/economic/uva`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            
            if (res.ok) {
                imported++;
                if (imported % 100 === 0) {
                    console.log(`Imported ${imported}/${missingRecords.length}...`);
                }
            } else {
                console.error(`Failed to import ${record.date}:`, await res.text());
            }
        } catch (error) {
            console.error(`Error importing ${record.date}:`, error.message);
        }
    }
    
    console.log(`\nImport complete! Imported ${imported} records.`);
    */
}

importUVAData().catch(console.error);
