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
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthKey(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

export async function loadEconomicData() {
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

    const monthBeforeStart = addMonths(new Date(contract.startDate), -1);
    const tcBase = getTCClosingMonth(tcMap, monthBeforeStart);

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
        }

        let inflationAccum: number | null = null;
        if (m > 0) {
            let inflationProduct = 1;
            for (let k = 0; k < m; k++) {
                const monthDate = addMonths(new Date(contract.startDate), k);
                const monthIPC = getIPCForMonth(ipcMap, monthDate);
                inflationProduct *= (1 + monthIPC);
            }
            inflationAccum = inflationProduct - 1;
        } else {
            inflationAccum = 0;
        }

        let devaluationAccum: number | null = null;
        if (tcBase > 0 && tcClosing > 0) {
            devaluationAccum = (tcClosing / tcBase) - 1;
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
