import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '@/lib/investments';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET transactions for an ON
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // Verify ownership first
        const investment = await prisma.investment.findFirst({
            where: { id, userId }
        });
        if (!investment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const transactions = await prisma.transaction.findMany({
            where: {
                investmentId: id,
                type: 'BUY'
            },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return unauthorized();
    }
}

// POST new purchase
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // 1. Try Legacy Investment
        const investment = await prisma.investment.findFirst({
            where: { id, userId }
        });

        if (investment) {
            const body = await request.json();
            const { date, quantity, price, commission } = body;
            const totalAmount = -(parseFloat(quantity) * parseFloat(price) + parseFloat(commission || 0));

            const transaction = await prisma.transaction.create({
                data: {
                    investmentId: id,
                    date: new Date(date),
                    type: 'BUY',
                    quantity: parseFloat(quantity),
                    price: parseFloat(price),
                    commission: parseFloat(commission || 0),
                    totalAmount,
                    currency: body.currency || 'ARS'
                }
            });

            // Generate and save cashflows
            const cashflows = await generateInvestmentCashflow(id);
            await saveInvestmentCashflows(id, cashflows);

            return NextResponse.json(transaction);
        }

        // 2. Try Global Asset logic
        // The ID passed in URL matches `asset.id` provided by the GET endpoint
        let holding = await prisma.userHolding.findFirst({
            where: {
                assetId: id,
                userId
            }
        });

        // If holding doesn't exist, check if it's a valid Global Asset and auto-subscribe (create holding)
        if (!holding) {
            const globalAsset = await prisma.globalAsset.findUnique({
                where: { id }
            });

            if (globalAsset) {
                holding = await prisma.userHolding.create({
                    data: {
                        userId,
                        assetId: id
                    }
                });
            }
        }

        if (holding) {
            const body = await request.json();
            const { date, quantity, price, commission } = body;
            const totalAmount = -(parseFloat(quantity) * parseFloat(price) + parseFloat(commission || 0));

            const gaTx = await prisma.globalAssetTransaction.create({
                data: {
                    holdingId: holding.id,
                    date: new Date(date),
                    type: 'BUY',
                    quantity: parseFloat(quantity),
                    price: parseFloat(price),
                    commission: parseFloat(commission || 0),
                    totalAmount,
                    currency: body.currency || 'ARS'
                }
            });
            return NextResponse.json(gaTx);
        }

        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        console.error('Error creating transaction:', error);
        return unauthorized();
    }
}
