const fetch = require('node-fetch');

async function resetPasswordInProduction() {
    const PROD_URL = 'https://passive-income-tracker.vercel.app';
    const ADMIN_SECRET = 'mi-secreto-super-seguro-123';

    console.log('🔄 Reseteando contraseña en PRODUCCIÓN...\n');

    try {
        const res = await fetch(`${PROD_URL}/api/admin/reset-password-temp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_SECRET}`
            },
            body: JSON.stringify({
                email: 'paato.ferrari@hotmail.com',
                newPassword: 'NuevaPassword123!'
            })
        });

        const result = await res.json();

        if (res.ok) {
            console.log('✅ Password reseteada exitosamente en PRODUCCIÓN!');
            console.log(`   Usuario: ${result.user.name} (${result.user.email})`);
            console.log('');
            console.log('📝 Credenciales:');
            console.log('   Email: paato.ferrari@hotmail.com');
            console.log('   Password: NuevaPassword123!');
            console.log('');
            console.log('🔗 Ahora probá ingresar en:');
            console.log(`   ${PROD_URL}/login`);
        } else {
            console.error('❌ Error:', result.error);
            if (result.details) console.error('   Details:', result.details);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

resetPasswordInProduction();
