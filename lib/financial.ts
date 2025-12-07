/**
 * Financial utility functions
 * Ported from Google Apps Script
 */

/**
 * Adds or subtracts months from a date, handling end-of-month edge cases
 */
export function addMonths(date: Date, months: number): Date {
    const currentDay = date.getDate();
    const newDate = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());

    // Handle month overflow (e.g., Jan 31 + 1 month should be Feb 28/29, not Mar 3)
    if (newDate.getDate() < currentDay) {
        newDate.setDate(0); // Set to last day of previous month
    }

    return newDate;
}

/**
 * Calculates exact day difference between two dates using UTC
 */
export function daysBetweenExact(d1: Date, d2: Date): number {
    const a = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const b = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((b - a) / (1000 * 3600 * 24));
}

/**
 * Formats a date as YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";

    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");

    return `${year}-${month}-${day}`;
}

/**
 * Calculates XIRR (Internal Rate of Return for irregular cash flows)
 * Uses Newton-Raphson method
 */
export function calculateXIRR(amounts: number[], dates: Date[]): number | null {
    if (!amounts || amounts.length < 2) return null;

    const hasPositive = amounts.some(a => a > 0);
    const hasNegative = amounts.some(a => a < 0);
    if (!hasPositive || !hasNegative) return null;

    const day0 = dates[0].getTime();
    const times = dates.map(d => (d.getTime() - day0) / (1000 * 3600 * 24));

    // Net Present Value function
    function npv(rate: number): number {
        let sum = 0;
        for (let i = 0; i < amounts.length; i++) {
            sum += amounts[i] / Math.pow(1 + rate, times[i] / 365);
        }
        return sum;
    }

    // Derivative of NPV
    function derivativeNPV(rate: number): number {
        let sum = 0;
        for (let i = 0; i < amounts.length; i++) {
            sum += -(times[i] / 365) * amounts[i] / Math.pow(1 + rate, times[i] / 365 + 1);
        }
        return sum;
    }

    // Try different initial guesses
    const guesses = [0.05, 0.1, 0.01, -0.1, 0.2];

    for (const guess of guesses) {
        let rate = guess;

        try {
            for (let iter = 0; iter < 200; iter++) {
                const f = npv(rate);
                const df = derivativeNPV(rate);

                if (Math.abs(df) < 1e-12) break;

                const newRate = rate - f / df;
                if (!isFinite(newRate)) break;
                if (Math.abs(newRate - rate) < 1e-9) {
                    rate = newRate;
                    break;
                }

                rate = newRate;
            }

            if (isFinite(rate) && Math.abs(npv(rate)) < 1e-4) {
                return Number(rate.toFixed(10));
            }
        } catch (e) {
            continue;
        }
    }

    return null;
}

/**
 * Gets the first day of the month for a given date
 */
export function getFirstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Gets the last day of the month for a given date
 */
export function getLastDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
