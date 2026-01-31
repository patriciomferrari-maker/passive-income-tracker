
import { prisma } from '../lib/prisma';

async function main() {
    const settings = await prisma.appSettings.findMany();
    console.log('All AppSettings:');
    settings.forEach(s => {
        console.log(`User: ${s.userId}, EnabledSections: "${s.enabledSections}"`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
