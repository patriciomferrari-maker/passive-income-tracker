// Debug script to see why chart is only showing 2 months
console.log('Testing accumulated chart data fetching...\n');

Promise.all([
    fetch('http://localhost:3000/api/admin/inflation').then(res => res.json()),
    fetch('http://localhost:3000/api/admin/economic').then(res => res.json())
])
    .then(([ipcData, tcData]) => {
        console.log('=== IPC DATA ===');
        console.log(`Total IPC records: ${ipcData.length}`);
        console.log('First 3:', ipcData.slice(0, 3));
        console.log('Last 3:', ipcData.slice(-3));

        console.log('\n=== TC BLUE DATA ===');
        console.log(`Total TC records: ${tcData.length}`);
        console.log('First 3:', tcData.slice(0, 3));
        console.log('Last 3:', tcData.slice(-3));

        // Process IPC
        const ipcProcessed = ipcData.map(item => ({
            date: `${item.year}-${String(item.month).padStart(2, '0')}-01`,
            value: item.value
        }));

        console.log('\n=== PROCESSED IPC ===');
        console.log('Last 12 months:');
        ipcProcessed.slice(-12).forEach(item => {
            console.log(`  ${item.date}: ${item.value}%`);
        });

        // Process TC - group by month
        const tcByMonth = new Map();
        tcData.forEach(item => {
            const monthKey = new Date(item.date).toISOString().slice(0, 7);
            const existing = tcByMonth.get(monthKey) || { sum: 0, count: 0 };
            tcByMonth.set(monthKey, {
                sum: existing.sum + item.value,
                count: existing.count + 1
            });
        });

        const tcProcessed = Array.from(tcByMonth.entries()).map(([monthKey, data]) => ({
            date: `${monthKey}-01`,
            value: data.sum / data.count
        })).sort((a, b) => a.date.localeCompare(b.date));

        console.log('\n=== PROCESSED TC (monthly avg) ===');
        console.log(`Total months: ${tcProcessed.length}`);
        console.log('Last 12 months:');
        tcProcessed.slice(-12).forEach(item => {
            console.log(`  ${item.date}: ${item.value.toFixed(2)}`);
        });

        console.log('\n=== COMPARISON ===');
        console.log(`IPC months: ${ipcProcessed.length}`);
        console.log(`TC months: ${tcProcessed.length}`);
        console.log(`IPC range: ${ipcProcessed[0].date} to ${ipcProcessed[ipcProcessed.length - 1].date}`);
        console.log(`TC range: ${tcProcessed[0].date} to ${tcProcessed[tcProcessed.length - 1].date}`);
    })
    .catch(err => console.error('Error:', err));
