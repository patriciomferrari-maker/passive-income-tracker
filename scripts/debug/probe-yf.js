
const yf = require('yahoo-finance2');
console.log('Type of yf:', typeof yf);
console.log('Keys of yf:', Object.keys(yf));
console.log('yf.default:', yf.default);
if (yf.default) {
    console.log('Type of yf.default:', typeof yf.default);
    console.log('Keys of yf.default:', Object.keys(yf.default));
}
console.log('yf.YahooFinance:', yf.YahooFinance);
