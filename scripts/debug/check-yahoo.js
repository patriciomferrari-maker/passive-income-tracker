const yahooFinance = require('yahoo-finance2').default;
console.log('Default Export:', yahooFinance);
console.log('Type of default export:', typeof yahooFinance);
try {
    console.log('quote exists:', typeof yahooFinance.quote);
} catch (e) {
    console.log('quote check failed');
}

const pkg = require('yahoo-finance2');
console.log('Full Package Exports:', Object.keys(pkg));
