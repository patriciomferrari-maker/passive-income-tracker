import { checkAllUtilities } from '../app/lib/utility-checker';
import { prisma } from '../lib/prisma'; // Correct path at root lib

async function main() {
    const userId = 'cmixpqcnk00003mnmljva12cg';
    console.log('🚀 Manually triggering utility check for user:', userId);

    try {
        const summary = await checkAllUtilities(userId);
        console.log('✅ Manual check completed successfully!');
        console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
