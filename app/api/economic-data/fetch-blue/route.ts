// API endpoint to fetch USD Blue exchange rate from external source
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Fetches historical USD Blue rates from DolarAPI
 * Free API that provides Argentine exchange rates
 */
export async function POST() {
    try {
        // Fetch current blue rate
        const response = await fetch('https://dolarapi.com/v1/dolares/blue');

        if (!response.ok) {
            throw new Error('Failed to fetch from DolarAPI');
        }

        const data = await response.json();

        // DolarAPI returns: { compra, venta, fechaActualizacion }
        // We use the "venta" (sell) price as it's what you'd pay to buy USD
        const rate = data.venta;
        const date = new Date(data.fechaActualizacion);

        // Set to first day of the month for consistency
        const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);

        // Check if we already have this month's data
        const existing = await prisma.economicIndicator.findFirst({
            where: {
                type: 'TC_USD_ARS',
                date: monthDate
            }
        });

        let saved;
        if (existing) {
            // Update existing
            saved = await prisma.economicIndicator.update({
                where: { id: existing.id },
                data: { value: rate }
            });
        } else {
            // Create new
            saved = await prisma.economicIndicator.create({
                data: {
                    type: 'TC_USD_ARS',
                    date: monthDate,
                    value: rate
                }
            });
        }

        return NextResponse.json({
            success: true,
            rate,
            date: monthDate,
            source: 'DolarAPI Blue',
            saved
        });
    } catch (error) {
        console.error('Error fetching blue rate:', error);
        return NextResponse.json(
            { error: 'Failed to fetch exchange rate', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * Fetch historical rates for a date range
 * Note: DolarAPI has limited historical data, typically last few months
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '3');

    try {
        const rates = [];
        const today = new Date();

        // Try to fetch for last N months
        for (let i = 0; i < months; i++) {
            const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthDate = targetDate.toISOString().split('T')[0];

            try {
                // Note: DolarAPI only has current data, not full history
                // For historical data, you'd need a different source or manual entry
                const response = await fetch('https://dolarapi.com/v1/dolares/blue');

                if (response.ok) {
                    const data = await response.json();

                    // Only save the current month's data
                    if (i === 0) {
                        rates.push({
                            date: targetDate,
                            rate: data.venta,
                            source: 'DolarAPI Blue (current)'
                        });
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch for ${monthDate}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            rates,
            note: 'DolarAPI only provides current data. For historical rates, use manual upload.'
        });
    } catch (error) {
        console.error('Error in GET:', error);
        return NextResponse.json(
            { error: 'Failed to fetch rates' },
            { status: 500 }
        );
    }
}
