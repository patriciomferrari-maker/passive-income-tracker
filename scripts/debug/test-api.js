async function testAPI() {
    try {
        const res = await fetch('http://localhost:3000/api/admin/inflation');
        const data = await res.json();

        console.log(`\nTotal records from API: ${data.length}\n`);

        // Group by year-month
        const grouped = {};
        data.forEach(d => {
            const key = `${d.year}-${d.month.toString().padStart(2, '0')}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(d);
        });

        console.log('Records per month:\n');
        Object.keys(grouped).sort().reverse().slice(0, 15).forEach(key => {
            console.log(`${key}: ${grouped[key].length} record(s)`);
            if (grouped[key].length > 1) {
                grouped[key].forEach((d, i) => {
                    console.log(`  [${i}] Value: ${d.value}, Interannual: ${d.interannualValue}`);
                });
            }
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAPI();
