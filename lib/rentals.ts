/**
 * Rentals Cashflow Generator - Enhanced with full IPC/TC tracking
 */

import { prisma } from './prisma';

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
    // contract.startDate is likely UTC midnight. 
    // We want to preserve the UTC month/year logic to avoid timezone backshifts.
    // Create a new date using UTC components.
    // Set to 1st of the calculated month.
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function getMonthKey(date: Date): number {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).getTime();
}

import { getIPCData, getUSDBlueData } from './economic-data';

export async function loadEconomicData() {
    // 1. Load IPC Data (unified source)
    const ipcData = await getIPCData();
    const ipcMap = new Map<number, number>();

    ipcData.forEach(record => {
        // Date is already Date object from Prisma
        // We use UTC Midnight on 1st of month for the key
        const date = new Date(Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth(), 1));
        const key = date.getTime();
        ipcMap.set(key, record.value); // Already converted to decimal in service
    });

    // 2. Load TC Data
    const tcData = await getUSDBlueData();
    const tcMap = new Map<number, number>();

    tcData.forEach(record => {
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

export async function generateContractCashflows(contract: ContractData) {
    const { ipcMap, tcMap } = await loadEconomicData();

    // UTC Fix: Align tcBase with Month 0 (First Payment Date) to ensure 0% devaluation at start.
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

            // Calculate IPC Accum for display purposes even if not used for adjustment
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
        // Only calculate devaluation if inflation is valid (data exists), ensuring consistent graph cutoff.
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

export async function regenerateContractCashflows(contractId: string) {
    await prisma.rentalCashflow.deleteMany({
        where: { contractId }
    });

    const contract = await prisma.contract.findUnique({
        where: { id: contractId }
    });

    if (!contract) {
        throw new Error('Contract not found');
    }

    const cashflows = await generateContractCashflows(contract);

    await prisma.rentalCashflow.createMany({
        data: cashflows
    });

    return cashflows;
}

export async function regenerateAllCashflows() {
    const contracts = await prisma.contract.findMany();
    let count = 0;
    for (const contract of contracts) {
        await regenerateContractCashflows(contract.id);
        count++;
    }
    return count;
}
