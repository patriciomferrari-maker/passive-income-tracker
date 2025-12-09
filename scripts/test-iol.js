
async function scrapeIOL(symbol) {
    // 1. Construct URL (Assume BCBA for now)
    const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${symbol}`;
    console.log(`Fetching ${url}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const html = await response.text();

        // Regex to find price:  US$ 103,20  or similar.
        // It seems to be in a list item: <li>- US$ 284.126,93</li> or similar text node
        // Based on chunk: "- US$ 284.126,93"

        // Let's try to find the "Último Precio" pattern. 
        // In the text chunk it appeared as "- US$ ..."

        const regex = /US\$\s*([\d\.,]+)/;
        const match = html.match(regex);

        if (match) {
            console.log(`Found Price for ${symbol}: ${match[1]} USD (Raw)`);
            // Clean it: remove points, replace comma with dot
            // 284.126,93 -> 284126.93
            // 103,20 -> 103.20
            // logic: remove all dots, replace comma with dot
            // Wait, Argentinian notation: 1.000,00

            let clean = match[1].replace(/\./g, '').replace(',', '.');
            console.log(`Parsed Price: ${parseFloat(clean)}`);
        } else {
            console.log('No price found in HTML.');
            // Dump partial HTML to debug if needed
            // console.log(html.substring(0, 5000));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

scrapeIOL('DNC5D');
scrapeIOL('MGC9O');
