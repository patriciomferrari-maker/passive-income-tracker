import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Listing Recent Notifications\n');

    const notifications = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: true }
    });

    if (notifications.length === 0) {
        console.log('❌ No notifications found.');
    } else {
        console.log(`✅ Found ${notifications.length} recent notifications:`);
        notifications.forEach(n => {
            console.log(`\n🆔 ID: ${n.id}`);
            console.log(`👤 User: ${n.user.email}`);
            console.log(`📌 Title: ${n.title}`);
            console.log(`📝 Message: ${n.message}`);
            console.log(`🔗 Link: ${n.link}`);
            console.log(`🕒 Created: ${n.createdAt.toLocaleString('es-AR')}`);
        });
    }

    console.log('\n✅ Verification complete!\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
