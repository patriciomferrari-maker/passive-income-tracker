// Import historical TC Blue data from Ambito (2015-2018)
// URL format in Ambito is DD-MM-YYYY but our API expects YYYY-MM-DD

console.log('Fetching TC Blue historical data from Ambito (2015-2018)...\n');

const startDate = '2015-01-01'; // YYYY-MM-DD format for our API
const endDate = '2018-12-31';

fetch('http://localhost:3000/api/economic-data/fetch-ambito', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate })
})
    .then(res => res.json())
    .then(data => {
        console.log('✅ Resultado:\n');

        if (data.success) {
            console.log('📊 Resumen:');
            console.log(`  ✓ Fuente: ${data.source}`);
            console.log(`  ✓ Rango: ${data.dateRange.start} a ${data.dateRange.end}`);
            console.log(`  ✓ Total registros: ${data.totalRecords}`);
            console.log(`  ✓ Nuevos creados: ${data.created}`);
            console.log(`  ✓ Actualizados: ${data.updated}`);
            console.log(`\n  ${data.message}`);

            if (data.created > 0) {
                console.log('\n✨ Datos históricos importados exitosamente!');
            }
        } else {
            console.error('❌ Error:', data.error);
            if (data.details) {
                console.error('   Detalles:', data.details);
            }
        }
    })
    .catch(err => {
        console.error('❌ Error de conexión:', err.message);
    });
