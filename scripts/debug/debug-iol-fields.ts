
async function searchIOLFields(symbol: string) {
    const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${symbol}`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const html = await res.text();
    const fields = ['UltimoPrecio', 'Moneda', 'Variacion', 'Apertura'];
    console.log(`--- Fields for ${symbol} ---`);
    for (const f of fields) {
        const regex = new RegExp(`data-field="${f}">([^<]*)<`, 'i');
        const match = html.match(regex);
        if (match) {
            console.log(`${f}: ${match[1].trim()}`);
        } else {
            console.log(`${f}: NOT FOUND`);
        }
    }
}

searchIOLFields('AAPL').catch(e => console.error(e));
searchIOLFields('AAPLD').catch(e => console.error(e));
