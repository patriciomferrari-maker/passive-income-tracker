
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { getDashboardStats } from '@/app/lib/dashboard-data';

// Force dynamic to ensure it runs fresh every time
export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'patriciomferrari@gmail.com';

export async function GET(request: Request) {
    // 1. Security Check (CRON_SECRET)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow local dev testing if needed, or secure strict
        if (process.env.NODE_ENV !== 'development') {
            return new NextResponse('Unauthorized', { status: 401 });
        }
    }

    const errors: string[] = [];
    const status = {
        db: 'UNKNOWN',
        api: 'UNKNOWN',
        dashboard: 'UNKNOWN'
    };

    console.log('[Health Check] Starting...');

    // --- 1. Database Check ---
    try {
        await prisma.user.findFirst({ select: { id: true } });
        status.db = 'OK';
    } catch (e: any) {
        status.db = 'FAILED';
        errors.push(`Database Error: ${e.message}`);
        console.error('[Health Check] DB Failed:', e);
    }

    // --- 2. External API Check (Dolar Blue) ---
    try {
        const res = await fetch('https://dolarapi.com/v1/dolares/blue', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        status.api = 'OK';
    } catch (e: any) {
        status.api = 'FAILED';
        errors.push(`DolarAPI Error: ${e.message}`);
        console.error('[Health Check] API Failed:', e);
    }

    // --- 3. Dashboard Data Check ---
    try {
        const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
        if (!adminUser) {
            // Not a failure of the system per se, but configuration
            status.dashboard = 'SKIPPED (Admin not found)';
        } else {
            await getDashboardStats(adminUser.id);
            status.dashboard = 'OK';
        }
    } catch (e: any) {
        status.dashboard = 'FAILED';
        errors.push(`Dashboard Data Error: ${e.message}`);
        console.error('[Health Check] Dashboard Failed:', e);
    }

    console.log('[Health Check] Result:', status);

    // --- 4. Alerting ---
    if (errors.length > 0) {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #be123c;">⚠️ Passive Income Tracker - Health Check FAILED</h2>
                <p>El control automático diario detectó errores en el sistema.</p>
                
                <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Estado de Servicios</h3>
                <ul>
                    <li><strong>Base de Datos:</strong> ${status.db === 'OK' ? '✅ OK' : '❌ FALLO'}</li>
                    <li><strong>Dolar API:</strong> ${status.api === 'OK' ? '✅ OK' : '❌ FALLO'}</li>
                    <li><strong>Dashboard Data:</strong> ${status.dashboard === 'OK' ? '✅ OK' : '❌ FALLO'}</li>
                </ul>

                <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Detalle de Errores</h3>
                <ul>
                    ${errors.map(e => `<li style="color: #be123c;">${e}</li>`).join('')}
                </ul>

                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    Ejecutado a las: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                </p>
            </div>
        `;

        try {
            await resend.emails.send({
                from: 'Passive Tracker <onboarding@resend.dev>', // Or configured domain
                to: ADMIN_EMAIL,
                subject: '⚠️ [ALERT] Health Check Failed',
                html: emailHtml
            });
            console.log('[Health Check] Alert email sent.');
        } catch (emailError) {
            console.error('[Health Check] Failed to send alert email:', emailError);
        }
    }

    return NextResponse.json({
        success: errors.length === 0,
        status,
        timestamp: new Date().toISOString()
    }, { status: errors.length === 0 ? 200 : 500 });
}
