// Script to fetch historical TC Blue data from Ambito (2015-2018)
console.log('Fetching historical USD Blue data from Ambito 2015-2018...\n');

fetch('http://localhost:3000/api/economic-data/fetch-ambito', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        startDate: '2015-01-01',
        endDate: '2018-12-31'
    })
})
    .then(res => res.json())
    .then(data => {
        console.log('✅ Resultado:');
        console.log(JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('\n📊 Resumen:');
            console.log(`  - Total registros: ${data.totalRecords}`);
            console.log(`  - Nuevos: ${data.created}`);
            console.log(`  - Actualizados: ${data.updated}`);
            console.log(`  - Rango: ${data.dateRange.start} a ${data.dateRange.end}`);
        }
    })
    .catch(err => {
        console.error('❌ Error:', err);
    });
