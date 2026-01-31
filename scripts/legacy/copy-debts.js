const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    const sourceEmail = 'patriciomferrari@gmail.com'
    const targetEmail = 'paato.ferrari@hotmail.com'

    console.log(`Searching for users...`)
    const sourceUser = await prisma.user.findUnique({ where: { email: sourceEmail } })
    const targetUser = await prisma.user.findUnique({ where: { email: targetEmail } })

    if (!sourceUser) {
        console.error(`Source user not found: ${sourceEmail}`)
        process.exit(1)
    }
    if (!targetUser) {
        console.error(`Target user not found: ${targetEmail}`)
        process.exit(1)
    }

    console.log(`Source User ID: ${sourceUser.id}`)
    console.log(`Target User ID: ${targetUser.id}`)

    // Fetch Debts with Payments
    const debts = await prisma.debt.findMany({
        where: { userId: sourceUser.id },
        include: { payments: true }
    })

    console.log(`Found ${debts.length} debts to copy.`)

    for (const debt of debts) {
        console.log(`Copying debt: ${debt.debtorName} (${debt.amount} ${debt.currency})`)

        // Create new Debt
        const newDebt = await prisma.debt.create({
            data: {
                userId: targetUser.id,
                debtorName: debt.debtorName,
                type: debt.type,
                startDate: debt.startDate,
                initialAmount: debt.initialAmount,
                currency: debt.currency,
                status: debt.status,
                details: debt.details,
                // Copy payments
                payments: {
                    create: debt.payments.map(p => ({
                        date: p.date,
                        amount: p.amount,
                        type: p.type,
                        description: p.description
                    }))
                }
            }
        })
        console.log(`  -> Created new debt ID: ${newDebt.id} with ${debt.payments.length} payments.`)
    }

    console.log('Migration completed successfully.')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
