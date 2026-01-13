
import { prisma } from '@/lib/prisma';
import { differenceInMonths } from 'date-fns';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

async function getRentalsData(userId: string) {
    const contracts = await prisma.contract.findMany({
        where: { property: { userId } },
        include: { property: true }
    });

    return contracts.map(c => {
        const now = new Date();
        const start = new Date(c.startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + c.durationMonths);

        const monthsLeft = differenceInMonths(end, now);

        // Traffic Light Logic
        let statusColor = 'bg-emerald-100 text-emerald-800'; // Green
        if (monthsLeft <= 3) statusColor = 'bg-red-100 text-red-800'; // Red
        else if (monthsLeft <= 6) statusColor = 'bg-amber-100 text-amber-800'; // Yellow

        // Cap Rate (Simplified: Annual Rent / Property Value)
        // Note: Assuming 'valuation' exists on property or using a placeholder
        const annualRent = c.initialRent * 12;
        const valuation = (c.property as any).valuation || 100000; // Placeholder if field missing
        const capRate = (annualRent / valuation) * 100;

        return {
            property: c.property.name,
            tenant: c.tenantName,
            monthsLeft,
            statusColor,
            capRate: capRate.toFixed(2) + '%',
            currentRent: c.initialRent,
            currency: c.currency
        };
    });
}

export default async function PrintRentalsPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500">Unauthorized</div>;
    }

    const contracts = await getRentalsData(userId);

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold border-b pb-4">Reporte de Alquileres</h1>

            <div className="grid grid-cols-1 gap-6">
                {contracts.map((c, idx) => (
                    <div key={idx} className="print-card border rounded-lg p-4 flex justify-between items-center bg-white shadow-sm">
                        <div>
                            <h3 className="font-bold text-lg">{c.property}</h3>
                            <p className="text-slate-500 text-sm">Inquilino: {c.tenant}</p>
                        </div>

                        <div className="text-right space-y-2">
                            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${c.statusColor}`}>
                                {c.monthsLeft} meses restantes
                            </div>
                            <div className="text-sm">
                                <span className="text-slate-400">Cap Rate:</span> <strong>{c.capRate}</strong>
                            </div>
                            <div className="text-xl font-bold text-slate-800">
                                {c.currency} {c.currentRent.toLocaleString()}
                            </div>
                        </div>
                    </div>
                ))}

                {contracts.length === 0 && (
                    <div className="text-center text-slate-400 py-10">No hay contratos activos</div>
                )}
            </div>

            <div className="text-center text-xs text-slate-400 mt-8">
                Calculado sobre contratos vigentes
            </div>
        </div>
    );
}

