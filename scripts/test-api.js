const fetch = require('node-fetch');

async function testAPI() {
    try {
        const res = await fetch('http://localhost:3000/api/admin/inflation');
        const data = await res.json();

        const data2025 = data.filter(x => x.year === 2025);

        console.log(`Total records from API: ${data.length}`);
        console.log(`2025 records: ${data2025.length}\n`);

        console.log('2025 Data from API:');
        data2025.forEach(d => {
            console.log(`${d.year}-${String(d.month).padStart(2, '0')} | ${d.value}%`);
        });

        // Check for duplicates
        const byMonth = {};
        data2025.forEach(d => {
            const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
            if (!byMonth[key]) byMonth[key] = 0;
            byMonth[key]++;
        });

        console.log('\n\nDuplicate months:');
        Object.entries(byMonth).forEach(([month, count]) => {
            if (count > 1) {
                console.log(`❌ ${month}: ${count} times`);
            }
        });

        const dupes = Object.values(byMonth).filter(c => c > 1);
        if (dupes.length === 0) {
            console.log('✅ No duplicates in API response');
        } else {
            console.log(`❌ Found ${dupes.length} duplicate months`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testAPI();
