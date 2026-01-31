
const lines = [
    "07-08-25 * MERPAGO*SOLODEPYURB 05/06 077569 10.833,16",
    "16-01-25 * VISUAR SA 12/12 009821 84.217,00"
];

const regex = /(\d{2}[-/\.]\d{2}(?:[-/\.]\d{2})?)\s+.*?\s+(?:(\d{1,2}\/\d{1,2})\s+)?(\d{6})\s+(?:(U\$S|USD)\s+)?((?:-)?(?:\d{1,3}\.)*(?:\d{1,3})(?:,\d{2}))/;

lines.forEach(line => {
    console.log(`Testing line: "${line}"`);
    const match = line.match(regex);
    if (match) {
        console.log("MATCH FOUND!");
        console.log("Date:", match[1]);
        console.log("Cuota (Group 2):", match[2]);
        console.log("Voucher:", match[3]);
        console.log("Amount:", match[5]);
    } else {
        console.log("NO MATCH");
    }
    console.log("-".repeat(20));
});
