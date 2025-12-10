
// Standalone debug


// Mimic fetchIOLPrice locally to debug
async function debugIOL(symbol) {
    console.log(`Debug Fetching: ${symbol}`);
    const cleanSymbol = symbol.replace('.BA', '');
    const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${cleanSymbol}`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();
        console.log(`Status: ${res.status}`);

        // Check Regex
        const regexDataField = /data-field="UltimoPrecio">([\d\.,]+)</;
        const matchDataVal = html.match(regexDataField);

        if (matchDataVal) {
            console.log(`Matched UltimoPrecio: ${matchDataVal[1]}`);

            // Check Currency
            let currency = 'UNKNOWN';
            if (html.includes('data-field="Moneda">US$') || html.includes('data-field="Moneda">USD') || html.includes('U$S')) {
                currency = 'USD (Detected via data-field or U$S body)';
            } else if (html.includes('data-field="Moneda">$')) {
                currency = 'ARS (Detected via data-field $)';
            }
            console.log(`Currency Logic Result: ${currency}`);

            // Dump snippets
            const monedaIdx = html.indexOf('data-field="Moneda"');
            if (monedaIdx !== -1) {
                console.log(`Snippet around Moneda: ${html.substring(monedaIdx, monedaIdx + 50)}`);
            }
        } else {
            console.log('No match for UltimoPrecio');
        }

    } catch (e) {
        console.error(e);
    }
}

async function run() {
    await debugIOL('VSCRD');
    await debugIOL('PN36D');
    await debugIOL('VSCRO');
}

run();
