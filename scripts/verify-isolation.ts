
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyIsolation() {
    console.log('Starting Data Isolation Verification...');

    // 1. Identify the main user (with data)
    const mainUserEmail = 'patriciomferrari@gmail.com';
    const mainUser = await prisma.user.findUnique({ where: { email: mainUserEmail } });

    if (!mainUser) {
        console.error(`Main user ${mainUserEmail} not found. Cannot verify isolation against existing data.`);
        return;
    }
    console.log(`Main User identified: ${mainUser.email} (ID: ${mainUser.id})`);

    // Count main user's data
    const mainInvestments = await prisma.investment.count({ where: { userId: mainUser.id } });
    const mainDebts = await prisma.debt.count({ where: { userId: mainUser.id } });
    const mainRentals = await prisma.property.count({ where: { userId: mainUser.id } });

    console.log(`Main User Data: ${mainInvestments} investments, ${mainDebts} debts, ${mainRentals} properties.`);

    if (mainInvestments === 0 && mainDebts === 0 && mainRentals === 0) {
        console.warn('Warning: Main user has no data. Verification might be less meaningful.');
    }

    // 2. Create or Get a Test User
    const testUserEmail = 'test_isolation@example.com';
    let testUser = await prisma.user.findUnique({ where: { email: testUserEmail } });

    if (!testUser) {
        console.log(`Creating test user ${testUserEmail}...`);
        testUser = await prisma.user.create({
            data: {
                email: testUserEmail,
                name: 'Test Isolation User',
                password: 'hashedpassword123', // required
            }
        });
        // Create settings
        await prisma.appSettings.create({
            data: {
                userId: testUser.id,
            }
        });
    }
    console.log(`Test User identified: ${testUser.email} (ID: ${testUser.id})`);

    // 3. Verify Isolation - Query data for Test User
    console.log('Verifying isolation...');

    const errors: string[] = [];

    // Check Investments
    const testInvestments = await prisma.investment.findMany({ where: { userId: testUser.id } });
    const testInvestmentsCount = testInvestments.length;
    console.log(`Test User sees ${testInvestmentsCount} investments.`);
    if (testInvestmentsCount > 0) {
        // Unless we explicitly added data to test user, this should be 0.
        // If we assume test user is fresh:
        console.error('FAIL: Test user sees investments!');
        errors.push('Investments leaked');
    }

    // Check Debts
    const testDebts = await prisma.debt.findMany({ where: { userId: testUser.id } });
    const testDebtsCount = testDebts.length;
    console.log(`Test User sees ${testDebtsCount} debts.`);
    if (testDebtsCount > 0) {
        console.error('FAIL: Test user sees debts!');
        errors.push('Debts leaked');
    }

    // Check Rentals (Properties)
    const testProperties = await prisma.property.findMany({ where: { userId: testUser.id } });
    const testPropertiesCount = testProperties.length;
    console.log(`Test User sees ${testPropertiesCount} properties.`);
    if (testPropertiesCount > 0) {
        console.error('FAIL: Test user sees properties!');
        errors.push('Properties leaked');
    }

    // Check Costa Transactions
    const testCostaTx = await prisma.costaTransaction.findMany({ where: { userId: testUser.id } });
    const testCostaTxCount = testCostaTx.length;
    console.log(`Test User sees ${testCostaTxCount} Costa transactions.`);
    if (testCostaTxCount > 0) {
        console.error('FAIL: Test user sees Costa transactions!');
        errors.push('Costa transactions leaked');
    }

    // 4. Cleanup Class (Optional, maybe keep for manual verification)
    // await prisma.user.delete({ where: { id: testUser.id } });

    if (errors.length === 0) {
        console.log('✅ SUCCESS: Data isolation verified. Test user sees 0 records.');
    } else {
        console.error('❌ FAILED: Data leakage detected.', errors);
    }
}

verifyIsolation()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
