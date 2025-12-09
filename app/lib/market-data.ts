await prisma.investment.update({
    where: { id: investmentId },
    data: { lastPrice: price, lastPriceDate: date }
});

// History (Once a day)
const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
const existing = await prisma.assetPrice.findFirst({ where: { investmentId, date: { gte: todayStart } } });

if (!existing) {
    await prisma.assetPrice.create({
        data: { investmentId, price, currency, date }
    });
}
        }

// 3. Fetch IPC (Existing logic)
export async function updateIPC(): Promise<IPCResult> {
    const seriesId = '172.3_JL_TOTAL_12_M_15';
    try {
        const url = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return { date: new Date(), value: 0, error: `API Error: ${res.status}` };
    } catch (e: any) {
        return { date: new Date(), value: 0, error: e.message };
    }
}
