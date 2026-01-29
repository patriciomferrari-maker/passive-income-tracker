
import { updateONs } from '../app/lib/market-data';

async function debugUpdate() {
    console.log('🚀 Starting Full CEDEAR/ON Update Debug...');
    const results = await updateONs();
    console.log('\n--- Update Results ---');
    results.forEach(r => {
        console.log(`${r.ticker}: ${r.price} ${r.currency} (${r.source}) ${r.error ? 'ERROR: ' + r.error : 'SUCCESS'}`);
    });
}

debugUpdate().catch(e => console.error(e));
