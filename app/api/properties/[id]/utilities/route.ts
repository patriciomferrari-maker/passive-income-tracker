import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

/**
 * GET /api/properties/[id]/utilities
 * Get latest utility checks for a property
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await Promise.resolve(params);
        const propertyId = resolvedParams.id;

        // Verify property belongs to user
        const property = await prisma.property.findFirst({
            where: {
                id: propertyId,
                userId
            },
            select: {
                id: true,
                name: true,
                gasId: true,
                electricityId: true,
                aysaId: true,
                municipalId: true,
                hasGarage: true,
                garageMunicipalId: true
            }
        });

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        // Get latest check for each service type
        const latestChecks = await prisma.$transaction([
            // Latest GAS check
            prisma.utilityCheck.findFirst({
                where: {
                    propertyId,
                    serviceType: 'GAS'
                },
                orderBy: { checkDate: 'desc' }
            }),
            // Latest ELECTRICITY check
            prisma.utilityCheck.findFirst({
                where: {
                    propertyId,
                    serviceType: 'ELECTRICITY'
                },
                orderBy: { checkDate: 'desc' }
            }),
            // Latest AYSA check
            prisma.utilityCheck.findFirst({
                where: {
                    propertyId,
                    serviceType: 'AYSA'
                },
                orderBy: { checkDate: 'desc' }
            }),
            // Latest MUNICIPAL/ABL check (property)
            prisma.utilityCheck.findFirst({
                where: {
                    propertyId,
                    serviceType: 'ABL', // Corrected from MUNICIPAL to match Writer
                    accountNumber: property.municipalId || undefined
                },
                orderBy: { checkDate: 'desc' }
            }),
            // Latest MUNICIPAL/ABL Cochera check (garage)
            prisma.utilityCheck.findFirst({
                where: {
                    propertyId,
                    serviceType: 'MUNICIPAL_GARAGE', // This might need update in writer too, currently writer uses ABL? No, writer needs update.
                    accountNumber: property.garageMunicipalId || undefined
                },
                orderBy: { checkDate: 'desc' }
            })
        ]);

        const [gasCheck, electricityCheck, aysaCheck, municipalCheck, garageMunicipalCheck] = latestChecks;

        return NextResponse.json({
            property: {
                id: property.id,
                name: property.name,
                gasId: property.gasId,
                electricityId: property.electricityId,
                aysaId: property.aysaId,
                municipalId: property.municipalId,
                hasGarage: property.hasGarage,
                garageMunicipalId: property.garageMunicipalId
            },
            checks: {
                gas: gasCheck,
                aysa: aysaCheck,
                electricity: electricityCheck,
                municipal: municipalCheck,
                garageMunicipal: garageMunicipalCheck
            }
        });

    } catch (error: any) {
        console.error('Error fetching utility checks:', error);
        return NextResponse.json(
            { error: 'Failed to fetch utility checks' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/properties/[id]/utilities/check
 * Trigger a manual check for utilities
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await Promise.resolve(params);
        const propertyId = resolvedParams.id;
        const body = await req.json();
        const { serviceType } = body; // 'GAS' or 'ELECTRICITY'

        // Verify property belongs to user
        const property = await prisma.property.findFirst({
            where: {
                id: propertyId,
                userId
            },
            select: {
                id: true,
                gasId: true,
                aysaId: true,
                electricityId: true
            }
        });

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        // Check if running in production (Vercel)
        const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

        if (isProduction) {
            return NextResponse.json({
                error: 'Manual scraping is disabled in production',
                message: 'Scraping only works in local development. Use scheduled checks instead.'
            }, { status: 503 });
        }

        // Import scrapers dynamically to avoid serverless bundle issues
        if (serviceType === 'GAS' && property.gasId) {
            const { checkMetrogas } = await import('@/lib/scrapers/metrogas');
            const result = await checkMetrogas(property.gasId);

            const check = await prisma.utilityCheck.create({
                data: {
                    propertyId,
                    serviceType: 'GAS',
                    accountNumber: property.gasId,
                    status: result.status,
                    debtAmount: result.debtAmount,
                    lastBillAmount: result.lastBillAmount,
                    lastBillDate: result.lastBillDate,
                    dueDate: result.dueDate,
                    isAutomatic: false, // Manual trigger
                    errorMessage: result.errorMessage
                }
            });

            return NextResponse.json({ success: true, check });
        }

        if (serviceType === 'ELECTRICITY' && property.electricityId) {
            const { checkEdenor } = await import('@/lib/scrapers/edenor');
            const result = await checkEdenor(property.electricityId);

            const check = await prisma.utilityCheck.create({
                data: {
                    propertyId,
                    serviceType: 'ELECTRICITY',
                    accountNumber: property.electricityId,
                    status: result.status,
                    debtAmount: result.debtAmount,
                    lastBillAmount: result.lastBillAmount,
                    lastBillDate: result.lastBillDate,
                    dueDate: result.dueDate,
                    isAutomatic: false, // Manual trigger
                    errorMessage: result.errorMessage
                }
            });

            return NextResponse.json({ success: true, check });
        }

        if (serviceType === 'AYSA' && property.aysaId) {
            const { checkAysaWhatsApp } = await import('@/lib/scrapers/aysa-whatsapp');
            const result = await checkAysaWhatsApp(property.aysaId);

            const check = await prisma.utilityCheck.create({
                data: {
                    propertyId,
                    serviceType: 'AYSA',
                    accountNumber: property.aysaId,
                    status: result.status,
                    debtAmount: result.debtAmount,
                    lastBillAmount: result.lastBillAmount,
                    lastBillDate: result.lastBillDate,
                    dueDate: result.dueDate,
                    isAutomatic: false, // Manual trigger
                    errorMessage: result.errorMessage
                }
            });

            return NextResponse.json({ success: true, check });
        }

        return NextResponse.json(
            { error: 'Invalid service type or missing account number' },
            { status: 400 }
        );

    } catch (error: any) {
        console.error('Error checking utility:', error);
        return NextResponse.json(
            { error: 'Failed to check utility', message: error.message },
            { status: 500 }
        );
    }
}
