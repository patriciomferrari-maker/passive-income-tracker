
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Fetch Cleaning Data
        const cleaningData = await prisma.barbosaCleaning.findMany({
            where: { userId },
            orderBy: [{ year: 'asc' }, { month: 'asc' }]
        });

        // 2. Fetch IPC Data (Inflation)
        const ipcData = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' }
        });

        // 3. Process Data
        if (cleaningData.length === 0) {
            return NextResponse.json({ chartData: [], tableData: [] });
        }

        // IPC Map: Key "YYYY-M" -> Value (Float %)
        const ipcMap = new Map<string, number>();
        ipcData.forEach(item => {
            const key = `${item.date.getUTCFullYear()}-${item.date.getUTCMonth() + 1}`;
            ipcMap.set(key, item.value);
        });

        // State for Accumulation
        const baseRecord = cleaningData[0]; // Baseline
        const basePrice = baseRecord.pricePerHour;

        let previousPrice = basePrice;
        let cumulativeInflationIndex = 1.0; // Starts at 1.0 (Base)

        const tableData = [];
        const chartData = [];

        // Loop through user records
        // We only chart/table the months WE HAVE DATA FOR? Or continuous?
        // User asked: "Desfasaje... a partir del primer mes".
        // Usually continuous is better for IPC accumulation, but table implies "rows of data I paid".
        // Let's iterate through the cleaningData array. If there are gaps, the accumulation might be jumpy if we don't account for missing months.
        // CORRECT APPROACH: Continuous loop from Start Month to End Month.
        // But for the Table, we only show rows where we have Data? Or show "Missing"?
        // Detailed request: "Precio hora... Total por mes". Implies rows where I paid.
        // However, IPC Accumulation MUST be continuous.

        // Strategy:
        // 1. Determine Start Period (Base) -> End Period (Last Record or Now?). User wants "Seguimiento", usually up to Now.
        // 2. Loop month by month.
        // 3. Calculate Accum IPC every month.
        // 4. Check if we have a Cleaning Record for that month.
        //    If YES: Calculate Price Metrics. Push to Table/Chart.
        //    If NO: We can't calculate Price Growth. We skip Table? Or show empty?
        //    Let's align Chart/Table to "Existing Records" but *calculating* IPC correctly (accumulating over gaps).

        const startYear = baseRecord.year;
        const startMonth = baseRecord.month;
        const lastRecord = cleaningData[cleaningData.length - 1]; // Or use current month?
        // Use last record to define end of data range, or Today?
        // Let's go up to Today to show "Current Inflation" even if I haven't updated price?
        // Let's stick to Last Record for the Table to avoid empty rows.

        // Actually, to correctly accumulate IPC, we need to iterate continuous months.
        let currentYear = startYear;
        let currentMonth = startMonth;
        const endYear = lastRecord.year;
        const endMonth = lastRecord.month;

        let isDone = false;

        while (!isDone) {
            const key = `${currentYear}-${currentMonth}`;
            const userRecord = cleaningData.find(d => d.year === currentYear && d.month === currentMonth);
            const ipcValue = ipcMap.get(key) || 0; // IPC of this month

            // Metric: Monthly IPC (for Table)
            // Metric: Accum IPC % (Compound) -> From Base.
            // Formula: Accum% = (Index - 1) * 100.
            const accumIPC = (cumulativeInflationIndex - 1) * 100;

            if (userRecord) {
                // We have a price
                const price = userRecord.pricePerHour;

                // Monthly Growth (vs Prev Price, theoretical or actual?)
                // Usually "Ajuste Mensual" is vs Previous Month Paid.
                // But what if gap? "vs Previous Paid Record".
                // If this is the Base (first iteration), growth is 0.

                // Let's store actual monthly growth if continuous?
                // Let's assume "Monthly Growth" = (Price - PrevPaid) / PrevPaid.
                // We need to track `lastPaidPrice` separately.

                // Accum Price Growth (vs Base)
                const accumPriceGrowth = ((price - basePrice) / basePrice) * 100;

                // Delta: Difference between my Accum Adjustment and Real Inflation Accum
                const delta = accumPriceGrowth - accumIPC;

                // For Monthly Growth column, we need the PREVIOUS record's price.
                // We can find the index in cleaningData.
                const recordIndex = cleaningData.findIndex(d => d.id === userRecord.id);
                const prevRecord = recordIndex > 0 ? cleaningData[recordIndex - 1] : null;
                const monthlyGrowth = prevRecord
                    ? ((price - prevRecord.pricePerHour) / prevRecord.pricePerHour) * 100
                    : 0;

                const row = {
                    period: `${currentYear}-${currentMonth.toString().padStart(2, '0')}`,
                    month: currentMonth,
                    year: currentYear,
                    pricePerHour: price,
                    hoursPerWeek: userRecord.hoursPerWeek,
                    totalMonthly: (price * userRecord.hoursPerWeek * 4), // 4 weeks approx
                    monthlyGrowth: monthlyGrowth,
                    accumPriceGrowth: accumPriceGrowth,
                    ipcMonthly: ipcValue,
                    ipcAccum: accumIPC,
                    delta: delta,
                    isBase: (recordIndex === 0)
                };

                tableData.push(row);
                chartData.push({
                    period: row.period, // YYYY-MM
                    accumPriceGrowth: parseFloat(accumPriceGrowth.toFixed(2)),
                    accumIPC: parseFloat(accumIPC.toFixed(2)),
                    delta: parseFloat(delta.toFixed(2))
                });
            }

            // Advance Inflation Index for NEXT month
            // If I am in Jan, IPC is 20%. Price in Jan is Base.
            // By Feb, inflation accumulated is 1.20.
            // So for Feb Row, IPC Accum should be 20%.
            // So we update index AFTER processing row.
            cumulativeInflationIndex = cumulativeInflationIndex * (1 + (ipcValue / 100));

            // Check loop end
            if (currentYear > endYear || (currentYear === endYear && currentMonth >= endMonth)) {
                isDone = true;
            } else {
                currentMonth++;
                if (currentMonth > 12) {
                    currentMonth = 1;
                    currentYear++;
                }
            }
        }

        return NextResponse.json({
            chartData,
            tableData: tableData.reverse() // Newest first for table
        });

    } catch (error: any) {
        console.error('Error in Cleaning Data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { year, month, pricePerHour, hoursPerWeek } = body;

        // Upsert
        const record = await prisma.barbosaCleaning.upsert({
            where: {
                userId_month_year: {
                    userId,
                    month,
                    year
                }
            },
            update: {
                pricePerHour: parseFloat(pricePerHour),
                hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek) : undefined,
                weeklyValue: (hoursPerWeek && pricePerHour) ? (parseFloat(pricePerHour) * parseInt(hoursPerWeek)) : 0,
            },
            create: {
                userId,
                month,
                year,
                pricePerHour: parseFloat(pricePerHour),
                hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek) : 0,
                weeklyValue: (hoursPerWeek && pricePerHour) ? (parseFloat(pricePerHour) * parseInt(hoursPerWeek)) : 0,
                monthlyIncrease: 0,
                paidValue: 0,
                // pricePerHour is required
            }
        });

        return NextResponse.json(record);
    } catch (error: any) {
        console.error('Error saving cleaning data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
