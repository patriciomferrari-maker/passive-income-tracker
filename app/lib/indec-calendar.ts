export const INDEC_IPC_CALENDAR_2026 = [
    "2026-02-10",
    "2026-03-12",
    "2026-04-14",
    "2026-05-14",
    "2026-06-11",
    "2026-07-14",
    "2026-08-13",
    "2026-09-10",
    "2026-10-13",
    "2026-11-12",
    "2026-12-15"
];

export function getNextIndecReleaseDate(): string | null {
    const now = new Date();
    // Normalize 'now' to start of day to ensure strict future comparison or same-day alert
    now.setHours(0, 0, 0, 0);

    for (const dateStr of INDEC_IPC_CALENDAR_2026) {
        // Assume release time is 16:00 as stated by user, but we just compare dates
        // Parse the YYYY-MM-DD string as local time (simplest approach for displays)
        const [year, month, day] = dateStr.split('-').map(Number);
        const releaseDate = new Date(year, month - 1, day); // Month is 0-indexed

        if (releaseDate >= now) {
            return dateStr;
        }
    }
    return null; // No more dates in calendar
}

export function getDaysUntilNextRelease(): number | null {
    const nextDateStr = getNextIndecReleaseDate();
    if (!nextDateStr) return null;

    const [year, month, day] = nextDateStr.split('-').map(Number);
    const releaseDate = new Date(year, month - 1, day);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffTime = releaseDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}
