import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all transactions, optionally filtered by type
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const marketParam = searchParams.get('market');
        const typeParam = searchParams.get('type');

        let typeFilter = {};
        if (typeParam) {
            const types = typeParam.split(',');
            if (types.length > 1) {
                typeFilter = { type: { in: types } };
            } else {
                typeFilter = { type: typeParam };
            }
        }

        const marketFilter = marketParam ? { market: marketParam } : {};

        const transactions = await prisma.transaction.findMany({
            where: {
                investment: {
                    userId,
                    ...typeFilter,
                    ...marketFilter
                }
            },
            include: {
                investment: {
                    select: {
                        ticker: true,
                        name: true,
                        type: true,
                        lastPrice: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        // 2. Fetch Global Asset Transactions
        const globalTransactions = await prisma.globalAssetTransaction.findMany({
            where: {
                holding: {
                    userId,
                    asset: {
                        ...(marketParam ? { market: marketParam } : {})
                    }
                }
            },
            include: {
                holding: {
                    include: { asset: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        const mappedGlobal = globalTransactions.map(tx => ({
            id: tx.id,
            date: tx.date,
            quantity: tx.quantity,
            price: tx.price,
            commission: tx.commission,
            totalAmount: tx.totalAmount,
            currency: tx.currency,
            type: tx.type,
            investment: {
                ticker: tx.holding.asset.ticker,
                name: tx.holding.asset.name,
                type: tx.holding.asset.type === 'CORPORATE_BOND' ? 'ON' : tx.holding.asset.type,
                lastPrice: tx.holding.asset.lastPrice
            }
        }));

        // Filter mappedGlobal by type if needed (client side filtering for global as types might vary)
        const filteredGlobal = typeParam
            ? mappedGlobal.filter(t => {
                // If typeParam is comma separated "ON,CEDEAR"
                const allowed = typeParam.split(',');
                return allowed.includes(t.investment.type || '') || (t.investment.type === 'ON' && allowed.includes('ON'));
            })
            : mappedGlobal;

        const combined = [...transactions, ...filteredGlobal].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(combined);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return unauthorized();
    }
}

// POST create a transaction (Generic)
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const json = await request.json();
        const { investmentId, date, quantity, price, commission, type = 'BUY', currency } = json;

        if (!investmentId || !date || !quantity || !price) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify ownership
        const investment = await prisma.investment.findUnique({
            where: { id: investmentId }
        });

        if (!investment || investment.userId !== userId) {
            return unauthorized();
        }

        // Validate SELL quantity
        if (type === 'SELL') {
            // Fetch current quantity from positions (we need to recalculate or rely on fifo logic)
            // Ideally we should use the same logic as positions endpoint, but for now specific check:
            // Let's use simpler check: sum of all previous transactions
            const txs = await prisma.transaction.findMany({
                where: { investmentId: investment.id }
            });

            let currentQty = 0;
            txs.forEach(tx => {
                if (tx.type === 'BUY') currentQty += tx.quantity;
                else if (tx.type === 'SELL') currentQty -= tx.quantity;
            });

            if (Number(quantity) > currentQty) {
                return NextResponse.json({
                    error: `No puedes vender ${quantity}. Tenencia actual: ${currentQty}`,
                    currentHoldings: currentQty
                }, { status: 400 });
            }
        }

        // For SELL transactions, we might want to store quantity as positive in the DB
        // but the current logic in PurchasesTab seems to assume positive quantity for display
        // and usually we handle the sign logic in the application.
        // HOWEVER, if we look at `PurchasesTab.tsx` code:
        // `totalPaid = Math.abs(tx.totalAmount)`
        // It seems `totalAmount` carries the sign? 
        // Let's stick to: Quantity always positive. Type determines direction.

        const amountSign = type === 'BUY' ? -1 : 1;
        // Buy = Outflow (Negative), Sell = Inflow (Positive)
        // Commission is always an expense (Negative impact on net)

        // Total Amount:
        // Buy: -(Qty * Price) - Commission
        // Sell: (Qty * Price) - Commission

        let totalAmount = 0;
        if (type === 'BUY') {
            totalAmount = -(quantity * price) - (commission || 0);
        } else {
            totalAmount = (quantity * price) - (commission || 0);
        }

        const transaction = await prisma.transaction.create({
            data: {
                investmentId,
                date: new Date(date),
                type,
                quantity: Number(quantity),
                price: Number(price),
                commission: Number(commission) || 0,
                totalAmount,
                currency: currency || investment.currency
            }
        });

        // Regenerate cashflows for the investment (New Logic)
        const { generateInvestmentCashflow, saveInvestmentCashflows } = await import('@/lib/investments');
        const cashflows = await generateInvestmentCashflow(investmentId);
        await saveInvestmentCashflows(investmentId, cashflows);

        return NextResponse.json(transaction);

    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
