
const yfModule = require('yahoo-finance2');
const YFClass = yfModule.default;

console.log('Trying to instantiate YFClass...');
try {
    const instance = new YFClass();
    console.log('Success!');
    console.log('Instance quote method:', instance.quote);
} catch (e) {
    console.log('Instantiation failed:', e.message);
}

// Check if static method works?
if (YFClass.quote) {
    console.log('YFClass has static quote method.');
}
