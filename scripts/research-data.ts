
import yahooFinance from 'yahoo-finance2';

async function research() {
    console.log('--- START RESEARCH ---');

    // 1. Yahoo Finance
    console.log('\n[1] Testing Yahoo Finance (US Treasuries & Arg ONs)');
    try {
        // US 10Y Yield
        const tnx = await yahooFinance.quote('^TNX') as any;
        console.log('✅ ^TNX (10Y Yield):', tnx.regularMarketPrice);

        // US ETF
        const shv = await yahooFinance.quote('SHV') as any;
        console.log('✅ SHV (Treasury ETF):', shv.regularMarketPrice);

        // Arg ONs
        const tickers = ['MGC9O.BA', 'YCA6O.BA', 'LMS1.BA', 'CS38D.BA'];
        for (const t of tickers) {
            try {
                const q = await yahooFinance.quote(t) as any;
                console.log(`✅ ${t}: ${q.regularMarketPrice} ${q.currency}`);
            } catch (e: any) {
                console.error(`❌ ${t}: Not Found or Error (${e.message})`);
            }
        }

    } catch (e: any) {
        console.error('CRITICAL FAULT in Yahoo Finance:', e.message);
    }

    // 2. IPC (Argentina) via datos.gob.ar
    console.log('\n[2] Testing IPC API (datos.gob.ar)');
    const ipcSeries = [
        '172.3_JL_TOTAL_12_M_15', // IPC Nacional General
        '148.3_INIVELNAL_Dici_M_26' // Another potential ID
    ];

    for (const id of ipcSeries) {
        try {
            const url = `https://apis.datos.gob.ar/series/api/series?ids=${id}&limit=1&sort=desc&format=json`;
            console.log(`Testing ID: ${id} -> ${url}`);

            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                console.log(`✅ Success for ${id}:`, JSON.stringify(json.data[0]));
            } else {
                console.error(`❌ Failed for ${id}: Status ${res.status}`);
            }
        } catch (e: any) {
            console.error(`❌ Error fetching ${id}: ${e.message}`);
        }
    }
}

research();
