
const yahooFinance = require('yahoo-finance2').default; // This is usually the default instance

async function testFetch() {
    console.log('--- Testing Yahoo Finance ---');

    // Suppress notices if possible or just ignore them
    // yahooFinance.suppressNotices(['yahooSurvey']); 

    // 1. Treasury Yield (10 Year)
    try {
        const tnx = await yahooFinance.quote('^TNX');
        console.log('Ten Year Yield (^TNX):', tnx.regularMarketPrice);
    } catch (e) {
        console.error('Error fetching ^TNX:', e.message);
    }

    // 2. Argentine ON 
    // We try a known one. YCA6O is typically 'YCA6O.BA'
    const onTickers = ['MGC9O.BA', 'YCA6O.BA', 'LMS1.BA'];

    for (const ticker of onTickers) {
        try {
            const data = await yahooFinance.quote(ticker);
            console.log(`ON ${ticker}:`, data.regularMarketPrice, data.currency);
        } catch (e) {
            // 404 means it's not there.
            console.error(`Error fetching ${ticker}:`, e.message);
        }
    }

    console.log('\n--- Testing IPC API (datos.gob.ar) ---');
    try {
        // IPC Nacional Empalme (Base 2016) - Monthly
        // Series ID: 148.3_INIVELNAL_Dici_M_26
        // or 172.3_JL_TOTAL_12_M_15 (Nivel General Total Nacional)
        // Let's try "Nivel General - Total Nacional"
        const seriesId = '148.3_INIVELNAL_Dici_M_26';
        const url = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&sort=desc`;

        const response = await fetch(url);
        if (response.ok) {
            const json = await response.json();
            console.log('IPC Data found:', JSON.stringify(json.data[0])); // Should be latest date and value
        } else {
            console.error('IPC Fetch Failed:', response.status);
        }
    } catch (e) {
        console.error('IPC Error:', e.message);
    }
}

testFetch();
