
import { getUSDashboardStats } from '@/app/lib/investments/treasury-dashboard-stats';

const TARGET_USER_ID = 'cmkheox6o000010w6ubl2uf5c';

async function main() {
    console.log('Fetching dashboard stats for user:', TARGET_USER_ID);
    try {
        const stats = await getUSDashboardStats(TARGET_USER_ID);
        console.log('--- Stats ---');
        console.log('Total Investment:', stats.capitalInvertido);
        console.log('Market Value:', stats.valorMercado);
        console.log('P&L Unrealized:', stats.gananciaNoRealizada);
        console.log('P&L Realized:', stats.gananciaRealizada);
        console.log('TIR:', stats.tirConsolidada);
        console.log('Composition:', stats.portfolioBreakdown);
    } catch (e) {
        console.error(e);
    }
}

main();
