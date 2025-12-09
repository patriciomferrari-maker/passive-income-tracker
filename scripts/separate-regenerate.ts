
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Re-creating script with updated logic derived from lib/rentals.ts

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
        const key = getMonthKey(new Date(record.date));
        ipcMap.set(key, record.value);
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

async function generateContractCashflows(contract: ContractData) {
    const { ipcMap, tcMap } = await loadEconomicData();

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

        const key = getMonthKey(paymentDate);
        const currentIPC = ipcMap.has(key) ? ipcMap.get(key) || 0 : 0;
        const currentTC = getTCForDate(tcMap, paymentDate);
        const tcClosing = getTCClosingMonth(tcMap, paymentDate);

        if (contract.currency === 'ARS') {
            ipcMonthly = currentIPC;

            if (contract.adjustmentType === 'IPC') {
                if (m === 0) {
                    amountARS = contract.initialRent;
                } else if (isAdjustmentMonth) {
                    const adjustmentStartMonth = m - contract.adjustmentFrequency;
                    let ipcProduct = 1;

                    for (let k = 0; k < contract.adjustmentFrequency; k++) {
                        const monthDate = addMonths(new Date(contract.startDate), adjustmentStartMonth + k);
                        const mKey = getMonthKey(monthDate);
                        const monthIPC = ipcMap.has(mKey) ? ipcMap.get(mKey) || 0 : 0;
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
        }

        let inflationAccum: number | null = null;
        if (m > 0) {
            let inflationProduct = 1;
            let validInflation = true;
            for (let k = 0; k < m; k++) {
                const monthDate = addMonths(new Date(contract.startDate), k);
                const mKey = getMonthKey(monthDate);

                if (!ipcMap.has(mKey)) {
                    validInflation = false;
                    break;
                }

                const monthIPC = ipcMap.get(mKey) || 0;
                inflationProduct *= (1 + monthIPC);
            }

            if (validInflation) {
                inflationAccum = inflationProduct - 1;
            }
        } else {
            inflationAccum = 0;
        }

        let devaluationAccum: number | null = null;
        // COUPLED CUTOFF: Only show deval if inflation is valid
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
    console.log('Regenerating all contract cashflows (Coupled Cutoff)...');

    const contracts = await prisma.contract.findMany();
    console.log(`Found ${contracts.length} contracts.`);

    for (const contract of contracts) {
        console.log(`Processing Contract: ${contract.id}`);
        try {
            await prisma.rentalCashflow.deleteMany({ where: { contractId: contract.id } });

            const contractData: ContractData = {
                id: contract.id,
                propertyId: contract.propertyId,
                startDate: contract.startDate,
                durationMonths: contract.durationMonths,
                initialRent: contract.initialRent,
                currency: contract.currency,
                adjustmentType: contract.adjustmentType,
                adjustmentFrequency: contract.adjustmentFrequency
            };

            const flows = await generateContractCashflows(contractData);

            if (flows.length > 0) {
                await prisma.rentalCashflow.createMany({ data: flows });
                console.log(`Saved ${flows.length} cashflows.`);
            }
        } catch (e: any) {
            console.error(`Error processing ${contract.id}:`, e.message);
        }
    }

    console.log('Done.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
