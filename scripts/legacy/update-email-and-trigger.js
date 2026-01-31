
const { PrismaClient } = require('@prisma/client');
// Removed invalid import

// Actually runDailyMaintenance is TS. I cannot require it directly in JS script unless I use ts-node or run via Next.js route.
// Better to update DB via script, then trigger via curl/fetch to the API route I checked earlier.

const prisma = new PrismaClient();

async function main() {
    const email = 'paato.ferrari@hotmail.com';
    const targetEmail = 'patriciomferrari@gmail.com';

    console.log(`Updating notificationEmails for ${email} to ${targetEmail}...`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('User not found');

    // Find appSettings
    const APP_SETTINGS_ID = (await prisma.appSettings.findFirst({ where: { userId: user.id } })).id;

    await prisma.appSettings.update({
        where: { id: APP_SETTINGS_ID },
        data: { notificationEmails: targetEmail }
    });

    console.log('Update successful.');
    console.log('User ID:', user.id);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
