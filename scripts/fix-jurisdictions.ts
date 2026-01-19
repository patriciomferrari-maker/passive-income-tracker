import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixJurisdictions() {
    try {
        console.log('📋 Fixing jurisdictions...\n');

        // Set Soldado to CABA (uses Metrogas)
        console.log('1. Setting Soldado to CABA...');
        const soldado = await prisma.$executeRaw`
      UPDATE "Property" 
      SET "jurisdiction" = 'CABA'::"Jurisdiction"
      WHERE "name" = 'Soldado';
    `;
        console.log(`   ✅ Updated ${soldado} property`);

        // Set all others to PROVINCIA (use Naturgy)
        console.log('2. Setting all other properties to PROVINCIA...');
        const others = await prisma.$executeRaw`
      UPDATE "Property" 
      SET "jurisdiction" = 'PROVINCIA'::"Jurisdiction"
      WHERE "name" != 'Soldado';
    `;
        console.log(`   ✅ Updated ${others} properties`);

        // Verify
        console.log('\n3. Verifying properties:');
        const properties = await prisma.$queryRaw<Array<{ name: string, jurisdiction: string, email: string, gasId: string | null }>>`
      SELECT p.name, p.jurisdiction, u.email, p."gasId"
      FROM "Property" p
      JOIN "User" u ON p."userId" = u.id
      ORDER BY p.name;
    `;

        properties.forEach(p => {
            const provider = p.jurisdiction === 'CABA' ? 'Metrogas' : 'Naturgy';
            console.log(`   - ${p.name} (${p.email}): ${p.jurisdiction} → ${provider} ${p.gasId ? `[${p.gasId}]` : '[No gas ID]'}`);
        });

        console.log('\n✅ Fix completed successfully!');

    } catch (error) {
        console.error('\n❌ Fix failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

fixJurisdictions();
