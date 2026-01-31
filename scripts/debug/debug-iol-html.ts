
async function getIOLHtml(symbol: string) {
    const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${symbol}`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const html = await res.text();
    console.log(html.substring(0, 5000)); // Print first 5000 chars
}

getIOLHtml('AAPL').catch(e => console.error(e));
