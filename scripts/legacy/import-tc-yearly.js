// Import TC Blue data in yearly chunks to avoid timeouts
console.log('Importing historical TC Blue data year by year...\n');

const years = [
    { start: '2015-01-01', end: '2015-12-31', label: '2015' },
    { start: '2016-01-01', end: '2016-12-31', label: '2016' },
    { start: '2017-01-01', end: '2017-12-31', label: '2017' },
    { start: '2018-01-01', end: '2018-12-31', label: '2018' }
];

async function importYear({ start, end, label }) {
    console.log(`\n📅 Procesando ${label}...`);

    try {
        const res = await fetch('http://localhost:3000/api/economic-data/fetch-ambito', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate: start, endDate: end })
        });

        const data = await res.json();

        if (data.success) {
            console.log(`  ✓ Total: ${data.totalRecords} registros`);
            console.log(`  ✓ Nuevos: ${data.created}`);
            console.log(`  ✓ Actualizados: ${data.updated}`);
            return { success: true, ...data };
        } else {
            console.error(`  ❌ Error: ${data.error}`);
            if (data.details) console.error(`     ${data.details}`);
            return { success: false, error: data.error };
        }
    } catch (err) {
        console.error(`  ❌ Error de conexión: ${err.message}`);
        return { success: false, error: err.message };
    }
}

async function importAll() {
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalRecords = 0;

    for (const year of years) {
        const result = await importYear(year);
        if (result.success) {
            totalCreated += result.created || 0;
            totalUpdated += result.updated || 0;
            totalRecords += result.totalRecords || 0;
        }
        // Wait a bit between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 RESUMEN TOTAL:');
    console.log(`  ✓ Total registros procesados: ${totalRecords}`);
    console.log(`  ✓ Nuevos creados: ${totalCreated}`);
    console.log(`  ✓ Actualizados: ${totalUpdated}`);
    console.log('\n✨ Importación completada!');
}

importAll().catch(err => {
    console.error('\n❌ Error fatal:', err);
});
