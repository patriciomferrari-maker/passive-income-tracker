
async function scrapeIOL(symbol) {
    const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${symbol}`;
    console.log(`Fetching ${url}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const html = await response.text();

        // Regex 1: Header Price (e.g., "- US$ 284.126,93")
        // Supports $ and US$
        const regexHeader = /-\s*(?:US)?\$\s*([\d\.,]+)/;
        let match = html.match(regexHeader);

        if (match && match[1]) {
            let currency = html.includes('US$') ? 'USD' : 'ARS';
            console.log(`[${symbol}] Header Price: ${match[1]} (${currency})`);
            return;
        }

        // Regex 2: "Ultimo Precio" or table data (Fallback)
        // Sometimes the header is empty "- $ -"
        console.log(`[${symbol}] Header empty, looking deeper...`);

        // Let's assume there is a data attribute or JSON in the page?
        // Or look for "Max: $ ..." as a sanity check of activity
        const regexMax = /Max:\s*(?:US)?\$\s*([\d\.,]+)/;
        let matchMax = html.match(regexMax);
        if (matchMax) {
            console.log(`[${symbol}] Found Max Price: ${matchMax[1]}`);
        } else {
            console.log(`[${symbol}] No price found.`);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

// Test both
scrapeIOL('DNC5D'); // Should be USD
scrapeIOL('MGC9O'); // Should be ARS?
