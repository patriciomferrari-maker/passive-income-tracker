import { PrismaClient } from '@prisma/client';

async function testConnection(url: string, name: string) {
    console.log(`Testing ${name}...`);
    try {
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: url
                }
            }
        });
        await prisma.$connect();
        const count = await prisma.user.count();
        console.log(`✅ ${name} Connected! Users: ${count}`);
        await prisma.$disconnect();
    } catch (error: any) {
        console.error(`❌ ${name} Failed:`, error.message.split('\n')[0]);
    }
}

async function main() {
    // 1. Full User on Pooler Host 5432
    await testConnection('postgresql://postgres.vcgqvsvdqabngoaodmsv:Pato1992.@aws-1-us-east-1.pooler.supabase.com:5432/postgres', 'Pooler Host 5432 (Full User)');

    // 2. Full User on standard direct host (Just in case DNS works but auth failed before silently? Unlikely if 'Can't reach')
    // await testConnection('postgresql://postgres.vcgqvsvdqabngoaodmsv:Pato1992.@db.vcgqvsvdqabngoaodmsv.supabase.co:5432/postgres', 'Direct Standard (Full User)');
}

main();
