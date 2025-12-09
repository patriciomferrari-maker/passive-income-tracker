
async function scrapeIOL(symbol) {
    const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${symbol}`;
    console.log(`Fetching ${url}...`);

    try {
        const response = await fetch(url);
        const html = await response.text();

        // Debug: Log the first 500 characters of the relevant section if possible
        // Or just matching loosely

        // Pattern seen in chunk: "- US$ 284.126,93"
        // It might be preceded by newlines or tabs
        const strictRegex = /-\s*(US\$|\$)\s*([\d\.,]+)/;
        const match = html.match(strictRegex);

        if (match) {
            console.log(`[${symbol}] MATCH FOUND: ${match[0]}`);
            console.log(`   Currency: ${match[1]}`);
            console.log(`   Value: ${match[2]}`);
        } else {
            console.log(`[${symbol}] No match. Dumping snippet around "US$" or "$" ...`);
            const idx = html.indexOf('$');
            if (idx !== -1) {
                console.log(html.substring(idx - 20, idx + 30));
            }
        }

    } catch (e) { console.error(e.message); }
}

scrapeIOL('DNC5D');
scrapeIOL('MGC9O');
