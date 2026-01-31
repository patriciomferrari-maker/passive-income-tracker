
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STOCKS_DATA = `
NVDA,NVIDIA,Tecnología (Semiconductores)
AAPL,Apple,Tecnología (Hardware)
MSFT,Microsoft,Tecnología (Software)
GOOGL,Alphabet (Google),Comunicación / Servicios
AMZN,Amazon,Consumo Discrecional / Cloud
META,Meta Platforms,Comunicación / Redes Sociales
AVGO,Broadcom,Tecnología (Semiconductores)
TSLA,Tesla,Consumo Discrecional (Autos)
BRK.B,Berkshire Hathaway,Finanzas / Conglomerado
LLY,Eli Lilly,Salud (Farmacéutica)
WMT,Walmart,Consumo Básico (Retail)
JPM,JPMorgan Chase,Finanzas (Bancos)
V,Visa,Finanzas (Servicios de Pago)
XOM,Exxon Mobil,Energía (Petróleo y Gas)
ORCL,Oracle,Tecnología (Software/Cloud)
MA,Mastercard,Finanzas (Servicios de Pago)
MU,Micron Technology,Tecnología (Semiconductores)
COST,Costco Wholesale,Consumo Básico (Retail)
AMD,Advanced Micro Devices,Tecnología (Semiconductores)
PLTR,Palantir Technologies,Tecnología (Software/IA)
ABBV,AbbVie,Salud (Biotecnología)
HD,Home Depot,Consumo Discrecional (Retail)
BAC,Bank of America,Finanzas (Bancos)
NFLX,Netflix,Comunicación / Entretenimiento
PG,Procter & Gamble,Consumo Básico
`;

async function main() {
    console.log('🌱 Seeding US Stocks into GlobalAsset...');

    const lines = STOCKS_DATA.trim().split('\n');
    let count = 0;

    for (const line of lines) {
        const [ticker, name, sector] = line.split(',');

        if (!ticker || !name) continue;

        console.log(`   Upserting ${ticker}: ${name}...`);

        await prisma.globalAsset.upsert({
            where: { ticker: ticker.trim() },
            update: {
                name: name.trim(),
                type: 'STOCK',
                market: 'US',
                currency: 'USD'
            },
            create: {
                ticker: ticker.trim(),
                name: name.trim(),
                type: 'STOCK',
                market: 'US',
                currency: 'USD'
            }
        });
        count++;
    }

    console.log(`✅ Seeded ${count} US Stocks successfully.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
