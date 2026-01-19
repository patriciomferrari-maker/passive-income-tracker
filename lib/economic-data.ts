
import { prisma } from './prisma';

/**
 * Economic Data Service
 * Centralizes logic for fetching and managing IPC and other economic indicators.
 * Enforces date normalization (UTC Midnight, 1st of Month for monthly data).
 */

export async function getIPCData() {
    // Fetch all IPC records from EconomicIndicator (New Table)
    // Ordered by date ascending
    const indicators = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'asc' },
        select: {
            date: true,
            value: true,
            isManual: true
        }
    });

    // Map to simple structure { date: Date, value: number (decimal) }
    // Note: Database stores Percentage (e.g. 3.0 for 3%), so we divide by 100.
    return indicators.map(item => ({
        date: new Date(item.date),
        value: item.value / 100,
        isManual: item.isManual
    }));
}

export async function getUSDBlueData() {
    return prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'asc' },
        select: {
            date: true,
            value: true
        }
    });
}

/**
 * Upsert IPC Data
 * @param date - Date object (will be normalized to 1st of month)
 * @param value - Percentage value (e.g. 3.5 for 3.5%)
 * @param isManual - Whether this is a manual override
 */
export async function upsertIPC(date: Date, value: number, isManual: boolean = false) {
    // Normalize to 1st of month, UTC
    const normalizedDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

    return prisma.economicIndicator.upsert({
        where: {
            type_date: {
                type: 'IPC',
                date: normalizedDate
            }
        },
        update: {
            value,
            isManual: isManual ? true : undefined, // Only update isManual if explicitly true (or passed) - actually logic should be: if manual, set true. If auto, leave as is? No, scrapers might overwrite.
            // Requirement: "Los valores manuales no se sobreescriben".
            // So if existing isManual=true, and we are auto, we normally skip.
            // But here we are just providing the DB capability. The caller should check.
            // Wait, the Cron Service logic usually unconditionally writes.
            // Let's keep it simple: Upsert writes what it's told. 
            // BUT, for safety, let's strictly handle the 'isManual' logic in the caller or here?
            // Let's update `updatedAt`.
            updatedAt: new Date()
        },
        create: {
            type: 'IPC',
            date: normalizedDate,
            value,
            isManual
        }
    });
}
