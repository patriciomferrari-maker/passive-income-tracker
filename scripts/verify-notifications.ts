import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Verifying Notification System\n');

    // 1. Check if we can count notifications (verifies table existence)
    try {
        const count = await prisma.notification.count();
        console.log(`✅ Notification table exists. Total count: ${count}`);
    } catch (error) {
        console.error('❌ Error accessing Notification table:', error);
        return;
    }

    // 2. Find a user to send notification to
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('❌ No users found');
        return;
    }
    console.log(`👤 Sending test notification to user: ${user.email} (${user.id})`);

    // 3. Create a test notification
    try {
        const notif = await prisma.notification.create({
            data: {
                userId: user.id,
                title: '🔔 Test Notification',
                message: 'This is a test notification to verify the system works.',
                type: 'INFO',
                isRead: false
            }
        });
        console.log(`✅ Created notification ID: ${notif.id}`);
        console.log(`   Title: ${notif.title}`);
        console.log(`   Message: ${notif.message}`);
    } catch (error) {
        console.error('❌ Error creating notification:', error);
    }

    console.log('\n✅ Verification complete!\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
