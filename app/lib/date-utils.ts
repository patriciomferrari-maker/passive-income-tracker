import { addHours, subHours } from 'date-fns';

/**
 * Standardizes a date to "Argentina Noon" (12:00 PM UTC-3 = 15:00 PM UTC).
 * This ensures consistency and prevents off-by-one day errors due to timezone shifts.
 * 
 * @param dateInput - Date object, ISO string, or YYYY-MM-DD string.
 * @param shiftStrategy - 'keep-day' (default) or 'shift-from-utc-midnight'.
 * 
 * Strategy 'keep-day':
 *   - Used for user inputs (e.g. '2025-02-01').
 *   - Goal: Result should be Feb 1st 12:00 ARG.
 *   - Logic: Parse UTC, Set UTC Hours to 15.
 * 
 * Strategy 'shift-from-utc-midnight' (Legacy PF fix):
 *   - Used when DB contains UTC midnight that represents "Local Midnight" of the displayed day?
 *   - Or when we want to be safe against timezone boundaries.
 *   - Logic: Shift -3h, then Set Noon.
 */
export function toArgNoon(dateInput: Date | string | number, shiftStrategy: 'keep-day' | 'fix-db-shift' = 'keep-day'): Date {
    const d = new Date(dateInput);

    // Safety: If invalid date
    if (isNaN(d.getTime())) return d;

    // 1. Identify valid day based on strategy
    let target = new Date(d);

    if (shiftStrategy === 'fix-db-shift') {
        // Shift -3h to see "Local Day", then anchor
        target = new Date(target.getTime() - (3 * 60 * 60 * 1000));
    }

    // 2. Force Noon ARG (15:00 UTC)
    target.setUTCHours(15, 0, 0, 0);

    return target;
}
