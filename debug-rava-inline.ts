
async function fetchRavaPrice(symbol: string) {
    try {
        const url = `https://www.rava.com/perfil/${symbol}`;
        console.log(`Fetching Rava: ${url}`);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!res.ok) {
            console.log('Status:', res.status);
            return null;
        }
        const html = await res.text();
        console.log('HTML Length:', html.length);

        const regex = /:res="([^"]+)"/;
        const match = html.match(regex);

        if (match) {
            console.log('Match found!');
            const jsonStr = match[1].replace(/&quot;/g, '"');
            try {
                const data = JSON.parse(jsonStr);
                const hist = data.coti_hist;
                if (Array.isArray(hist) && hist.length > 0) {
                    const last = hist[hist.length - 1];
                    console.log('Last Data:', last);
                    return { price: last.cierre, updateDate: last.fecha };
                }
            } catch (e) {
                console.error(`Error parsing Rava JSON for ${symbol}:`, e);
            }
        } else {
            console.log('No regex match.');
            // Dump snippet
            console.log('Snippet:', html.substring(0, 500));
        }
    } catch (e: any) {
        console.error(`Rava Fetch Error (${symbol}):`, e.message);
    }
    return null;
}

async function main() {
    console.log('Testing Rava Scraping with AAPL and AAPLD...');
    const tickers = ['AAPL', 'AAPLD'];
    for (const t of tickers) {
        const res = await fetchRavaPrice(t);
        console.log(`${t} result:`, res);
    }
}

main();
