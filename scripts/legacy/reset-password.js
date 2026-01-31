const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetPassword() {
    const email = 'paato.ferrari@hotmail.com';
    const newPassword = 'NuevaPassword123!'; // Cambia esto por la contraseña que quieras

    try {
        // Verificar que el usuario existe
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log(`❌ Usuario ${email} no encontrado`);
            await prisma.$disconnect();
            return;
        }

        console.log(`✅ Usuario encontrado: ${user.name || email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log('');

        // Hashear la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Actualizar la contraseña
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        console.log('✅ Contraseña actualizada exitosamente!');
        console.log('');
        console.log('📝 Credenciales:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${newPassword}`);
        console.log('');
        console.log('⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
