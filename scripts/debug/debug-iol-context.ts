
async function captureMoreIOL(symbol: string) {
    const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${symbol}`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const html = await res.text();
    // Search for any currency symbols
    const idx = html.indexOf('UltimoPrecio');
    if (idx !== -1) {
        console.log('--- Context around UltimoPrecio ---');
        console.log(html.substring(idx - 500, idx + 1000));
    } else {
        console.log('UltimoPrecio not found in HTML');
    }
}

captureMoreIOL('AAPL').catch(e => console.error(e));
