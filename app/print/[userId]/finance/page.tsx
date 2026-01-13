
import { prisma } from '@/lib/prisma';
import { ExpensePieChart } from '../../ExpensePieChart';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

async function getFinanceData(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. Get Top 5 Expenses
    const topExpenses = await prisma.barbosaTransaction.findMany({
        where: {
            userId,
            date: { gte: startOfMonth, lte: endOfMonth },
            amountUSD: { gt: 0 } // Only real expenses
        },
        orderBy: { amountUSD: 'desc' },
        take: 5
    });

    // 2. Savings Calculation (Income vs Expense)
    // Note: Assuming 'Income' is tracked or derived. For now, simple Aggregation.
    const aggregations = await prisma.barbosaTransaction.groupBy({
        by: ['category'],
        where: {
            userId,
            date: { gte: startOfMonth, lte: endOfMonth },
            type: 'EXPENSE'
        },
        _sum: { amountUSD: true }
    });

    const chartData = aggregations.map(a => ({
        name: a.category,
        value: a._sum.amountUSD || 0
    })).sort((a, b) => b.value - a.value);

    // Mock Income for Savings Demo (Replace with real source if available)
    const estimatedIncome = 5000;
    const totalExpenses = chartData.reduce((sum, i) => sum + i.value, 0);
    const savings = estimatedIncome - totalExpenses;
    const savingsRate = (savings / estimatedIncome) * 100;

    return {
        topExpenses,
        chartData,
        summary: { income: estimatedIncome, expense: totalExpenses, savings, savingsRate }
    };
}

export default async function PrintFinancePage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500">Unauthorized</div>;
    }

    const data = await getFinanceData(userId);

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold border-b pb-4">Reporte del Hogar (Barbosa)</h1>

            <div className="grid grid-cols-2 gap-8">
                {/* 1. Categorical Breakdown (Pie Chart) */}
                <div className="print-card border rounded p-4 bg-white">
                    <h3 className="font-bold text-center mb-4">Distribución de Gastos</h3>
                    <ExpensePieChart data={data.chartData} />
                </div>

                {/* 2. Savings Analysis */}
                <div className="space-y-4">
                    <div className="print-card border rounded p-4 bg-slate-50">
                        <h3 className="text-sm text-slate-500 uppercase font-bold">Capacidad de Ahorro</h3>
                        <div className="mt-2 flex justify-between items-end border-b pb-2">
                            <span>Ingresos (Est.)</span>
                            <span className="font-mono text-emerald-600">$ {data.summary.income}</span>
                        </div>
                        <div className="mt-2 flex justify-between items-end border-b pb-2">
                            <span>Gastos Reales</span>
                            <span className="font-mono text-red-600">$ {data.summary.expense.toLocaleString()}</span>
                        </div>
                        <div className="mt-4 pt-2 border-t flex justify-between items-end">
                            <span className="font-bold">Ahorro Neto</span>
                            <div className="text-right">
                                <div className={`text-2xl font-bold ${data.summary.savings > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    $ {data.summary.savings.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-400">{data.summary.savingsRate.toFixed(1)}% tasa</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Top 5 Expenses */}
            <div className="print-card border rounded overflow-hidden mt-8">
                <div className="bg-slate-100 p-3 font-bold border-b text-sm">TOP 5 Gastos del Mes</div>
                <table className="w-full text-sm">
                    <tbody>
                        {data.topExpenses.map((tx, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                                <td className="p-3 text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="p-3 font-medium">{tx.description}</td>
                                <td className="p-3">
                                    <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs">{tx.category}</span>
                                </td>
                                <td className="p-3 text-right font-mono font-bold">
                                    USD {tx.amountUSD?.toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="text-center text-xs text-slate-400 mt-8">
                Basado en datos procesados por IA
            </div>
        </div>
    );
}
