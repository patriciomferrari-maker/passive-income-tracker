const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function verifyPassword() {
    const email = 'paato.ferrari@hotmail.com';
    const testPassword = 'NuevaPassword123!';

    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log('❌ Usuario no encontrado');
            await prisma.$disconnect();
            return;
        }

        console.log('✅ Usuario encontrado:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Password hash: ${user.password.substring(0, 20)}...`);
        console.log('');

        // Verificar si la contraseña matchea
        const isValid = await bcrypt.compare(testPassword, user.password);

        console.log('🔐 Verificación de contraseña:');
        console.log(`   Password ingresada: ${testPassword}`);
        console.log(`   ¿Es válida?: ${isValid ? '✅ SÍ' : '❌ NO'}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyPassword();
