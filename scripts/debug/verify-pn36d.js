
async function verifyPN36D() {
    const url = 'https://iol.invertironline.com/titulo/cotizacion/BCBA/PN36D';
    console.log(`Fetching ${url}...`);

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();

        // Target: "US$ 101,75"
        // Let's look for "Último Operado" followed by value, or the large price tag.

        // Regex 1: The dash format seen before "- US$ ..."
        const regexDash = /-\s*(US\$|\$)\s*([\d\.,]+)/;
        const matchDash = html.match(regexDash);

        if (matchDash) {
            console.log('Match Dash:', matchDash[0]);
        } else {
            console.log('No Dash Match.');
        }

        // Regex 2: Loose search for "US$ 101,75" pattern
        const regexLoose = /(US\$|\$)\s*([\d\.,]+)/g;
        let m;
        console.log('Loose matches:');
        let count = 0;
        while ((m = regexLoose.exec(html)) !== null) {
            if (count++ > 10) break;
            // Filter out obviously wrong values (like 0,00 or massive numbers if not expected)
            console.log(` - ${m[0]} (Val: ${m[2]})`);
        }

        // Dump a snippet if needed
        const idx = html.indexOf('101,75');
        if (idx !== -1) {
            console.log('Snippet around 101,75:');
            console.log(html.substring(idx - 50, idx + 50));
        } else {
            console.log('Price 101,75 NOT FOUND in HTML.');
        }

    } catch (e) {
        console.error(e);
    }
}

verifyPN36D();
