
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Types & Helpers from lib/rentals.ts ---

interface ContractData {
    id: string;
    propertyId: string;
    startDate: Date;
    durationMonths: number;
    initialRent: number;
    currency: string;
    adjustmentType: string;
    adjustmentFrequency: number;
}

function addMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function getMonthKey(date: Date): number {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).getTime();
}

async function loadEconomicData() {
    const ipcRecords = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'asc' }
    });

    const ipcMap = new Map<number, number>();
    ipcRecords.forEach(record => {
        // Use UTC Midnight on 1st of month for the key
        const date = new Date(Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth(), 1));
        const key = date.getTime();
        ipcMap.set(key, record.value / 100);
    });

    const tcRecords = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'asc' }
    });

    const tcMap = new Map<number, number>();
    tcRecords.forEach(record => {
        const timestamp = new Date(record.date).getTime();
        tcMap.set(timestamp, record.value);
    });

    return { ipcMap, tcMap };
}

function getIPCForMonth(ipcMap: Map<number, number>, date: Date): number {
    const key = getMonthKey(date);
    return ipcMap.get(key) || 0;
}

function getTCForDate(tcMap: Map<number, number>, date: Date): number {
    const targetTime = date.getTime();
    let latestTC = 0;
    for (const [timestamp, value] of tcMap.entries()) {
        if (timestamp <= targetTime) {
            latestTC = value;
        } else {
            break;
        }
    }
    return latestTC;
}

function getTCClosingMonth(tcMap: Map<number, number>, date: Date): number {
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return getTCForDate(tcMap, endOfMonth);
}

// --- Main Logic ---

async function generateContractCashflows(contract: ContractData, ipcMap: Map<number, number>, tcMap: Map<number, number>) {
    // UTC Fix: Align tcBase with Month 0
    const startPaymentDate = addMonths(new Date(contract.startDate), 0);
    const tcBase = getTCForDate(tcMap, startPaymentDate);

    const cashflows = [];
    let previousAmountARS: number | null = null;

    for (let m = 0; m < contract.durationMonths; m++) {
        const paymentDate = addMonths(new Date(contract.startDate), m);
        const isAdjustmentMonth = (m % contract.adjustmentFrequency === 0 && m !== 0);

        let amountARS = 0;
        let amountUSD = 0;
        let ipcMonthly: number | null = null;
        let ipcAccumulated: number | null = null;

        const currentIPC = getIPCForMonth(ipcMap, paymentDate);
        const currentTC = getTCForDate(tcMap, paymentDate);
        const tcClosing = getTCClosingMonth(tcMap, paymentDate);

        ipcMonthly = currentIPC;

        if (contract.currency === 'ARS') {
            if (contract.adjustmentType === 'IPC') {
                if (m === 0) {
                    amountARS = contract.initialRent;
                } else if (isAdjustmentMonth) {
                    const adjustmentStartMonth = m - contract.adjustmentFrequency;
                    let ipcProduct = 1;

                    for (let k = 0; k < contract.adjustmentFrequency; k++) {
                        const monthDate = addMonths(new Date(contract.startDate), adjustmentStartMonth + k);
                        const monthIPC = getIPCForMonth(ipcMap, monthDate);
                        ipcProduct *= (1 + monthIPC);
                    }

                    ipcAccumulated = ipcProduct - 1;
                    amountARS = (previousAmountARS || contract.initialRent) * (1 + ipcAccumulated);
                } else {
                    amountARS = previousAmountARS || contract.initialRent;
                }
            } else {
                amountARS = contract.initialRent;
            }

            amountUSD = currentTC > 0 ? amountARS / currentTC : 0;
            previousAmountARS = amountARS;

        } else if (contract.currency === 'USD') {
            amountUSD = contract.initialRent;
            amountARS = currentTC > 0 ? amountUSD * currentTC : 0;

            if (isAdjustmentMonth) {
                const adjustmentStartMonth = m - contract.adjustmentFrequency;
                let ipcProduct = 1;
                for (let k = 0; k < contract.adjustmentFrequency; k++) {
                    const monthDate = addMonths(new Date(contract.startDate), adjustmentStartMonth + k);
                    const monthIPC = getIPCForMonth(ipcMap, monthDate);
                    ipcProduct *= (1 + monthIPC);
                }
                ipcAccumulated = ipcProduct - 1;
            }
        }

        let inflationAccum: number | null = null;
        if (m > 0) {
            let inflationProduct = 1;
            let validInflation = true;
            for (let k = 0; k < m; k++) {
                const monthDate = addMonths(new Date(contract.startDate), k);
                const key = getMonthKey(monthDate);

                if (!ipcMap.has(key)) {
                    validInflation = false;
                    break;
                }
                const monthIPC = ipcMap.get(key) || 0;
                inflationProduct *= (1 + monthIPC);
            }

            if (validInflation) {
                inflationAccum = inflationProduct - 1;
            }
        } else {
            inflationAccum = 0;
        }

        let devaluationAccum: number | null = null;
        if (inflationAccum !== null && tcBase > 0 && currentTC > 0) {
            devaluationAccum = (currentTC / tcBase) - 1;
        }

        cashflows.push({
            contractId: contract.id,
            date: paymentDate,
            monthIndex: m + 1,
            amountARS,
            amountUSD,
            ipcMonthly,
            ipcAccumulated,
            tc: currentTC,
            tcBase,
            tcClosingMonth: tcClosing,
            inflationAccum,
            devaluationAccum
        });
    }

    return cashflows;
}

async function main() {
    console.log('🚀 Starting Standalone Rentals Regeneration...');
    try {
        const { ipcMap, tcMap } = await loadEconomicData();
        console.log(`✅ Loaded Economic Data: IPC=${ipcMap.size}, TC=${tcMap.size}`);

        const contracts = await prisma.contract.findMany();
        console.log(`Found ${contracts.length} contracts to process.`);

        for (const contract of contracts) {
            console.log(`Processing Contract ${contract.id} (${contract.tenantName})...`);

            // Delete old cashflows
            await prisma.rentalCashflow.deleteMany({ where: { contractId: contract.id } });

            // Generate new ones
            const cashflows = await generateContractCashflows(contract, ipcMap, tcMap);

            // Save
            await prisma.rentalCashflow.createMany({ data: cashflows });
            console.log(`  -> Regenerated ${cashflows.length} cashflows.`);
        }

        console.log('✨ All Done!');
    } catch (e) {
        console.error('Failure:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
