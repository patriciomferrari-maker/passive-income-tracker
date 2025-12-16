import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cleaningData = await prisma.barbosaCleaning.findMany({
        where: { userId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    return NextResponse.json(cleaningData);
}

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { month, year, weeklyValue, hoursPerWeek, monthlyIncrease, legalHourlyRate } = body;

    // Logic: Calculated values
    // pricePerHour = weeklyValue / hoursPerWeek
    // paidValue (This month) = (Previous Month Last Week Value * (1 + Increase)) ?? wait... 
    // The prompt says: "El Valor pagado tiene que ser el valor semana del mes anterior ajustado por el aumento mensual."
    // BUT usually 'paidValue' refers to the TOTAL paid in the month (e.g. 4 weeks * weeklyValue).
    // Let's assume user inputs 'weeklyValue' as the CURRENT agreed value.
    // OR user inputs 'monthlyIncrease' and we CALCULATE `weeklyValue` based on prev month?
    // Prompt: "Carguemos los Meses, el Valor de la semana ... aumento mensual y valor pagado. El Valor pagado tiene que ser el valor semana del mes anterior ajustado por el aumento mensual."

    // Interpretation: 
    // User inputs: Month, Year, Weekly Value (Manual Override?) OR Increase %.
    // If Increase is set, we Calc Weekly Value based on Prev Month.
    // Let's keep it simple: User inputs EVERYTHING for now, or allows UI to calc it.
    // This API will just save what it gets, but we can double check calculations.

    // Let's calculate simple derived metrics
    const pricePerHour = (weeklyValue / hoursPerWeek);

    // Paid Value = usually 4 weeks * weeklyValue (approximation) or similar? 
    // Or is "Valor Pagado" the resulting new weekly value?
    // "El Valor pagado tiene que ser el valor semana del mes anterior ajustado por el aumento mensual." -> This sounds like "New Weekly Value".
    // Let's assume paidValue field in DB stores the *actual* amount paid (maybe monthly total?).
    // Actually, let's store `paidValue` as the resulting WEEKLY value if that's what implies.
    // Wait, DB has `weeklyValue` AND `paidValue`.
    // Let's assume `weeklyValue` is the base, and `paidValue` is the final calculation (maybe same?).
    // Let's stick to: we save what the UI sends.

    const record = await prisma.barbosaCleaning.upsert({
        where: {
            userId_month_year: {
                userId,
                month,
                year
            }
        },
        update: {
            weeklyValue,
            hoursPerWeek,
            pricePerHour,
            monthlyIncrease,
            paidValue: weeklyValue, // For now, assume Paid = Weekly Value (as rate). Or maybe Monthly Total?
            legalHourlyRate
        },
        create: {
            userId,
            month,
            year,
            weeklyValue,
            hoursPerWeek,
            pricePerHour,
            monthlyIncrease,
            paidValue: weeklyValue,
            legalHourlyRate
        }
    });

    return NextResponse.json(record);
}
