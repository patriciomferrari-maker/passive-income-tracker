
function normalizeDate(raw: string, yearContext: number, isJan: boolean): string {
    // Handle formats: 10-08-25, 10/08/25, 12-05
    let [day, month, year] = raw.trim().replace(/[-]/g, '/').split('/').map(Number);

    if (!year) {
        if (isJan && month === 12) year = yearContext - 1;
        else year = yearContext;
    } else if (year < 100) {
        year += 2000;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseArgAmount(raw: string): number {
    let clean = raw.replace(/\./g, '');
    clean = clean.replace(',', '.');
    return parseFloat(clean);
}

function validateRegex(line: string) {
    // THE NEW REGEX
    const regex = /(\d{2}[-/\.]\d{2}(?:[-/\.]\d{2})?)\s+.*?\s+(?:(\d{2}\/\d{2})\s+)?(\d{6})\s+(?:(U\$S|USD)\s+)?((?:-)?(?:\d{1,3}\.)*(?:\d{1,3})(?:,\d{2}))/;

    const match = line.match(regex);
    if (match) {
        const rawDate = match[1];
        const rawVoucher = match[3];
        const rawCurrency = match[4];
        const rawAmount = match[5];

        const currency = rawCurrency && ['U$S', 'USD'].includes(rawCurrency) ? 'USD' : 'ARS';

        console.log(`MATCH: Date=${rawDate}, Voucher=${rawVoucher}, Currency=${currency}, Amount=${rawAmount}`);
    } else {
        console.log("NO MATCH");
    }
}

const lines = [
    "12-01-24 EXTRACTO BANCARIO 001234 1.500,00",
    "12-01-24 COMPRA USD 001235 U$S 10,00",
    "12-01-24 PAYPAL 001236 USD 15,50",
    "12-01-24 NETFLIX 001237 15,99",
    "10-01 STARBUCKS 01/12 004590 5.400,00"
];

lines.forEach(l => {
    console.log(`Testing: "${l}"`);
    validateRegex(l);
    console.log("---");
});
