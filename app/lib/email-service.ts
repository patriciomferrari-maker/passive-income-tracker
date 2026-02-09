
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDividendAlert(ticker: string, company: string, eventName: string, date: Date, pdfUrl: string, details?: any) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[Email] Skipped: No RESEND_API_KEY');
        return;
    }

    try {
        const { paymentDate, amountUSD } = details || {};

        await resend.emails.send({
            from: 'Passive Income <alerts@resend.dev>', // Or verified domain
            to: ['patri.ferrari@gmail.com'], // Hardcoded or env var
            subject: `💰 Dividendo Anunciado: ${ticker}`,
            html: `
                <h1>Nuevo Anuncio de Dividendo</h1>
                <p><strong>${ticker}</strong> - ${company}</p>
                <p>${eventName}</p>
                <p>Fecha Anuncio: ${date.toLocaleDateString()}</p>
                
                ${amountUSD ? `<p style="font-size: 1.2em; color: green;">Estimado: USD $${amountUSD}/acción</p>` : ''}
                ${paymentDate ? `<p>Fecha Pago Estimada: ${paymentDate}</p>` : ''}

                <br/>
                <a href="${pdfUrl}" target="_blank" style="padding: 10px 20px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px;">
                    Ver Documento Oficial (PDF)
                </a>
            `
        });
        console.log(`[Email] Sent alert for ${ticker}`);
    } catch (error) {
        console.error('[Email] Failed to send:', error);
    }
}

interface IPCMonthData {
    month: string;
    value: number;
}

export async function sendContractAdjustmentAlert(contractData: any) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('⚠️ RESEND_API_KEY not configured - email will not be sent');
        return;
    }

    try {
        const { tenantName, propertyName, oldRent, newRent, percentage, adjustmentDate, ipcMonths, ownerEmail } = contractData;

        if (!ownerEmail) {
            console.error('❌ [Email] No owner email provided for contract adjustment alert');
            return;
        }

        const formatCurrency = (val: number) => new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);

        const increment = newRent - oldRent;

        // Generate IPC monthly rows
        const ipcRows = (ipcMonths || []).map((ipc: IPCMonthData, idx: number) => {
            const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            return `
                <tr style="background-color: ${bgColor}; border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 16px; color: #475569; font-size: 14px; font-weight: 500;">
                        ${ipc.month}
                    </td>
                    <td style="padding: 14px 16px; text-align: right; color: #0f172a; font-weight: 600; font-family: monospace; font-size: 15px;">
                        ${ipc.value.toFixed(2)}%
                    </td>
                </tr>
            `;
        }).join('');

        await resend.emails.send({
            from: 'Passive Income <alerts@resend.dev>',
            to: [ownerEmail],
            subject: `🏠 Ajuste Alquiler: ${propertyName}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <div style="max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background-color: #1e293b; padding: 32px; text-align: center; border-bottom: 4px solid #f59e0b;">
            <div style="display: inline-block; padding: 4px 12px; background-color: rgba(245, 158, 11, 0.2); border-radius: 20px; color: #fbbf24; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                🏠 AJUSTE DE ALQUILER
            </div>
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${propertyName}</h1>
            <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">Inquilino: ${tenantName}</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
            <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                Corresponde la <strong>actualización del contrato</strong> según el índice IPC acordado.
            </p>

            <!-- Last Rent -->
            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
                <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Último Valor de Alquiler</div>
                <div style="color: #0f172a; font-size: 28px; font-weight: 700; margin-top: 8px; font-family: monospace;">
                    ${formatCurrency(oldRent)}
                </div>
            </div>

            <!-- IPC Table -->
            <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #fef3c7; padding: 12px 16px; border-bottom: 1px solid #fcd34d;">
                    <h3 style="margin: 0; color: #92400e; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        📊 Índice IPC - Período de Ajuste
                    </h3>
                </div>
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tbody>
                        ${ipcRows}
                    </tbody>
                    <tfoot style="background-color: #fef3c7; border-top: 2px solid #fcd34d;">
                        <tr>
                            <td style="padding: 14px 16px; color: #92400e; font-weight: 700; font-size: 13px; text-transform: uppercase;">
                                IPC Acumulado
                            </td>
                            <td style="padding: 14px 16px; text-align: right; color: #92400e; font-weight: 700; font-family: monospace; font-size: 18px;">
                                ${percentage}%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- New Rent -->
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
                <div style="color: rgba(255,255,255,0.8); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                    ✅ Nuevo Valor Sugerido
                </div>
                <div style="color: #ffffff; font-size: 32px; font-weight: 700; margin-top: 8px; font-family: monospace;">
                    ${formatCurrency(newRent)}
                </div>
                <div style="color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 8px;">
                    Incremento: ${formatCurrency(increment)}
                </div>
            </div>

            <!-- Note -->
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                    <strong style="color: #1e40af;">Cálculo:</strong> ${formatCurrency(oldRent)} × (1 + ${percentage}%) = ${formatCurrency(newRent)}
                </p>
            </div>

            <p style="margin-top: 16px; color: #94a3b8; font-size: 12px; text-align: center;">
                Este valor ha sido calculado automáticamente.<br/>Por favor confirmar con el inquilino.
            </p>
        </div>
    </div>

    <div style="max-width: 560px; margin: 0 auto 40px; text-align: center;">
        <p style="color: #cbd5e1; font-size: 11px; margin: 0;">
            &copy; 2026 Passive Income Tracker. Private & Confidential.
        </p>
    </div>
</body>
</html>
            `
        });
        console.log(`✅ [Email] Sent contract alert for ${propertyName} to ${ownerEmail}`);
    } catch (error) {
        console.error(`❌ [Email] Failed to send contract alert for ${propertyName}:`, error);
        console.error('[Email] Error details:', JSON.stringify(error, null, 2));
    }
}
