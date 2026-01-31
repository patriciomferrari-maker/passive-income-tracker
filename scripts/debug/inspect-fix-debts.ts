
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Inspect/Fix Debts ---');
    const user = await prisma.user.findUnique({ where: { email: 'paato.ferrari@hotmail.com' } });
    if (!user) throw new Error('User not found');

    const debts = await prisma.debt.findMany({ where: { userId: user.id } });

    for (const d of debts) {
        console.log(`Debt: ${d.id} | Name: "${d.name}" | Amount: ${d.initialAmount} | Type: ${d.type}`);

        if (!d.name || d.name === 'undefined' || d.name.trim() === '') {
            console.log('-> Fixing undefined/empty name...');
            // await prisma.debt.update({ where: { id: d.id }, data: { name: 'Deuda Sin Nombre' } }); 
            // Or delete? If it's $8390 USD, it might be real but missing name?
            // Let's delete it if it looks bogus, or rename. 
            // "undefined" is likely a bug.

            // Check if it corresponds to "Deuda Inicial"?
            // I'll rename it to "Deuda (Corregir nombre)".
            await prisma.debt.update({
                where: { id: d.id },
                data: { name: 'Deuda (Revisar)' }
            });
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
