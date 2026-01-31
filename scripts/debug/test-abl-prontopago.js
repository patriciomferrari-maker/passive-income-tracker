"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var puppeteer_1 = __importDefault(require("puppeteer"));
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var TEST_PARTIDA, browser, page, continueBtn, searchMethodBtn, agipOption, dropdown, planOption, partidaInput, inputs, result, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('🚀 Starting ProntoPago ABL CABA Test (User Flow) - VERSION CHECK 2...');
                TEST_PARTIDA = '3786683';
                return [4 /*yield*/, puppeteer_1.default.launch({
                        headless: false, // Visual debug
                        defaultViewport: null,
                        args: ['--start-maximized']
                    })];
            case 1:
                browser = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, 47, 49, 51]);
                return [4 /*yield*/, browser.newPage()];
            case 3:
                page = _a.sent();
                // Step 0: Go to Home/Login
                console.log('0️⃣  Navigating to Home...');
                return [4 /*yield*/, page.goto('https://pagos.prontopago.com.ar/#/login', {
                        waitUntil: 'networkidle0',
                        timeout: 60000
                    })];
            case 4:
                _a.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
            case 5:
                _a.sent();
                // Step 1: "Continuar sin usuario"
                console.log('1️⃣  Clicking "Continuar sin usuario"...');
                return [4 /*yield*/, page.evaluateHandle(function () {
                        var elements = Array.from(document.querySelectorAll('div, span, p, h6')); // Broad search
                        return elements.find(function (el) { var _a; return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) === 'Continuar sin usuario'; });
                    })];
            case 6:
                continueBtn = _a.sent();
                if (!(continueBtn && continueBtn.asElement())) return [3 /*break*/, 8];
                return [4 /*yield*/, page.evaluate(function (el) { return el.click(); }, continueBtn)];
            case 7:
                _a.sent();
                return [3 /*break*/, 9];
            case 8:
                console.log('⚠️  "Continuar sin usuario" not found. Maybe already logged out or on landing? Checking URL...');
                _a.label = 9;
            case 9: return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
            case 10:
                _a.sent();
                // Step 2: "Buscar por empresa y dato de referencia"
                console.log('2️⃣  Clicking "Buscar por empresa..."');
                return [4 /*yield*/, page.evaluateHandle(function () {
                        var elements = Array.from(document.querySelectorAll('div, span, button'));
                        return elements.find(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('Buscar por empresa y dato de referencia'); });
                    })];
            case 11:
                searchMethodBtn = _a.sent();
                if (!(searchMethodBtn && searchMethodBtn.asElement())) return [3 /*break*/, 13];
                return [4 /*yield*/, page.evaluate(function (el) { return el.click(); }, searchMethodBtn)];
            case 12:
                _a.sent();
                return [3 /*break*/, 14];
            case 13:
                // Maybe we are already there?
                console.log('⚠️  Button not found, checking if input exists...');
                _a.label = 14;
            case 14: return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
            case 15:
                _a.sent();
                // Step 3: Search "Patentes" and select AGIP
                console.log('3️⃣  Searching "Patentes"...');
                return [4 /*yield*/, page.waitForSelector('input[type="text"]', { timeout: 10000 })];
            case 16:
                _a.sent();
                return [4 /*yield*/, page.type('input[type="text"]', 'patentes')];
            case 17:
                _a.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
            case 18:
                _a.sent(); // Wait for results
                console.log('   Selecting "AGIP GCBA - ABL IIBB PATENTES"...');
                return [4 /*yield*/, page.evaluateHandle(function () {
                        // Probably a list item or card
                        var elements = Array.from(document.querySelectorAll('div, mat-option, span'));
                        // Exact match or contains
                        return elements.find(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('AGIP GCBA - ABL IIBB PATENTES'); });
                    })];
            case 19:
                agipOption = _a.sent();
                if (!(agipOption && agipOption.asElement())) return [3 /*break*/, 21];
                return [4 /*yield*/, page.evaluate(function (el) { return el.click(); }, agipOption)];
            case 20:
                _a.sent();
                return [3 /*break*/, 22];
            case 21: throw new Error('AGIP Option not found');
            case 22: return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
            case 23:
                _a.sent();
                // Step 4: Modalidad de Pago -> "COBRANZA SIN FACTURA - PLAN DE FACILIDADES"
                console.log('4️⃣  Selecting Payment Mode...');
                return [4 /*yield*/, page.$('.mat-select-trigger')];
            case 24:
                dropdown = _a.sent();
                if (!dropdown) return [3 /*break*/, 26];
                return [4 /*yield*/, dropdown.click()];
            case 25:
                _a.sent();
                return [3 /*break*/, 28];
            case 26:
                console.log('   Dropdown selector not found, trying text click "Seleccione una opción"...');
                return [4 /*yield*/, page.evaluate(function () {
                        var _a;
                        var els = Array.from(document.querySelectorAll('span'));
                        (_a = els.find(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('Seleccione una opción'); })) === null || _a === void 0 ? void 0 : _a.click();
                    })];
            case 27:
                _a.sent();
                _a.label = 28;
            case 28: return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
            case 29:
                _a.sent();
                // Click Option
                console.log('   Clicking "PLAN DE FACILIDADES"...');
                return [4 /*yield*/, page.evaluateHandle(function () {
                        var options = Array.from(document.querySelectorAll('span, mat-option, div[role="option"]'));
                        return options.find(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('COBRANZA SIN FACTURA - PLAN DE FACILIDADES'); });
                    })];
            case 30:
                planOption = _a.sent();
                if (!(planOption && planOption.asElement())) return [3 /*break*/, 32];
                return [4 /*yield*/, page.evaluate(function (el) { return el.click(); }, planOption)];
            case 31:
                _a.sent();
                return [3 /*break*/, 33];
            case 32: throw new Error('Plan de facilidades option not found');
            case 33: return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
            case 34:
                _a.sent();
                // Step 5: Enter Partida
                console.log('5️⃣  Entering Partida:', TEST_PARTIDA);
                return [4 /*yield*/, page.waitForSelector('input[data-placeholder*="partida"], input[id*="mat-input"]', { timeout: 5000 }).catch(function () { return null; })];
            case 35:
                partidaInput = _a.sent();
                if (!!partidaInput) return [3 /*break*/, 41];
                return [4 /*yield*/, page.$$('input')];
            case 36:
                inputs = _a.sent();
                if (!(inputs.length > 0)) return [3 /*break*/, 39];
                return [4 /*yield*/, inputs[inputs.length - 1].type(TEST_PARTIDA)];
            case 37:
                _a.sent();
                return [4 /*yield*/, page.keyboard.press('Enter')];
            case 38:
                _a.sent();
                return [3 /*break*/, 40];
            case 39: throw new Error('Partida input not found');
            case 40: return [3 /*break*/, 44];
            case 41: return [4 /*yield*/, partidaInput.type(TEST_PARTIDA)];
            case 42:
                _a.sent();
                return [4 /*yield*/, page.keyboard.press('Enter')];
            case 43:
                _a.sent();
                _a.label = 44;
            case 44:
                // Step 6: Wait for and Parse Results
                console.log('6️⃣  Waiting for results...');
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 6000); })];
            case 45:
                _a.sent();
                return [4 /*yield*/, page.evaluate(function () {
                        var body = document.body.innerText;
                        return {
                            textSnapshot: body.substring(0, 500).replace(/\n/g, ' '),
                            hasDebt: body.includes('$'),
                            amounts: Array.from(document.querySelectorAll('mat-cell, span'))
                                .filter(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('$'); })
                                .map(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
                        };
                    })];
            case 46:
                result = _a.sent();
                console.log('📊 Result Snapshot:', result);
                return [3 /*break*/, 51];
            case 47:
                error_1 = _a.sent();
                console.error('❌ Error in flow:', error_1.message);
                return [4 /*yield*/, page.screenshot({ path: 'scripts/debug-prontopago-flow.png' })];
            case 48:
                _a.sent();
                return [3 /*break*/, 51];
            case 49: return [4 /*yield*/, browser.close()];
            case 50:
                _a.sent();
                console.log('🛑 Done.');
                return [7 /*endfinally*/];
            case 51: return [2 /*return*/];
        }
    });
}); })();
