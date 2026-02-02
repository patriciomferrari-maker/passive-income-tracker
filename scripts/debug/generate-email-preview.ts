
import { generateMonthlyReportEmail, MonthlyReportData } from '@/app/lib/email-template';
import fs from 'fs';
import path from 'path';

const mockData: MonthlyReportData = {
    userName: 'Patricio',
    month: 'Febrero',
    year: '2026',
    dashboardUrl: 'http://localhost:3000',
    totalDebtPending: 1500,
    totalBank: 5000,
    totalArg: 10000,
    totalUSA: 25000,
    maturities: [],
    rentalEvents: [],
    hasRentals: true,
    hasArg: true,
    hasUSA: true,
    hasBank: true,
    hasDebts: true
};

const html = generateMonthlyReportEmail(mockData);
const outputPath = path.join(process.cwd(), 'email-preview.html');
fs.writeFileSync(outputPath, html);
console.log(`Email preview generated at: ${outputPath}`);
