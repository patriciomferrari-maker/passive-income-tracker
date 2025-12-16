import { NextRequest, NextResponse } from 'next/server';
import { generateRentalsPdfBuffer, generateInvestmentsPdfBuffer } from '@/app/lib/pdf-generator';
import { generateDashboardPdf } from '@/app/lib/pdf-capture';
import { getUserId } from '@/app/lib/auth-helper';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'rentals';
    const mode = searchParams.get('mode'); // 'headless' or undefined
    const targetUserId = searchParams.get('userId');

    // HEADLESS MODE (Puppeteer)
    if (mode === 'headless') {
        try {
            // Use provided userId or fallback to current session user (if available, though typically debugging is easier with explicit ID)
            let userId = targetUserId;
            if (!userId) {
                // Try to get from session
                try {
                    userId = await getUserId();
                } catch (e) {
                    return NextResponse.json({ error: 'User ID required for headless preview. Pass ?userId=...' }, { status: 400 });
                }
            }

            if (!userId) {
                return NextResponse.json({ error: 'User ID required' }, { status: 400 });
            }

            const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
            // Note: This requires CRON_SECRET to be set in .env
            const buffer = await generateDashboardPdf(userId, type as 'rentals' | 'investments', appUrl);

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="preview_headless_${type}.pdf"`
                }
            });
        } catch (error: any) {
            console.error('Headless Generation Error:', error);
            return NextResponse.json({ error: 'Headless Generation Failed', details: error.message }, { status: 500 });
        }
    }

    // LEGACY / MOCK MODE (React-PDF with Dummy Data)
    // Dummy Data for Preview Micking the Real Dashboard
    const mockRentalsData = {
        month: 'Diciembre',
        year: '2024',
        userName: 'Patricio',
        summary: {
            totalIncomeUSD: 3523.29,
            totalIncomeARS: 0,
            activeContracts: 5,
            nextExpiration: { property: 'NZ 30', date: '2026-02-01' },
            nextAdjustment: { property: 'N4 3C', date: '2025-01-01' }
        },
        contracts: [
            // Simulating the 4 cards in the screenshot
            { property: 'NZ 3C', tenant: 'Inquilino', rent: 500, currency: 'USD', nextAdjustment: '2025-01-01', expiration: '2026-02-01', chartHistory: [400, 400, 400, 420, 420, 450, 450, 480, 500, 500, 500, 500] },
            { property: 'KM 32', tenant: 'Inquilino', rent: 671, currency: 'USD', nextAdjustment: '2025-01-01', expiration: '2026-05-01', chartHistory: [600, 600, 620, 620, 640, 640, 650, 660, 670, 671, 671, 671] },
            { property: 'Q2 20', tenant: 'Inquilino', rent: 779, currency: 'USD', nextAdjustment: '2025-01-01', expiration: '2026-08-01', chartHistory: [700, 710, 720, 730, 740, 750, 760, 770, 775, 779, 779, 779] },
            { property: 'Manant.', tenant: 'Inquilino', rent: 1000, currency: 'USD', nextAdjustment: '2025-01-01', expiration: '2026-05-01', chartHistory: [900, 920, 940, 960, 980, 990, 1000, 1000, 1000, 1000, 1000, 1000] },
        ],
        globalHistory: [900, 1500, 1520, 1600, 1800, 1850, 1900, 2100, 2300, 2350, 2400, 2380] // Mock for the big bar chart
    };

    let buffer: Buffer;

    if (type === 'investments') {
        buffer = await generateInvestmentsPdfBuffer(mockRentalsData); // Reuse for now or mock inv data
    } else {
        buffer = await generateRentalsPdfBuffer(mockRentalsData);
    }

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="preview_${type}.pdf"`
        }
    });
}
