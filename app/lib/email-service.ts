
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

export async function sendContractAdjustmentAlert(contractData: any) {
    if (!process.env.RESEND_API_KEY) return;

    try {
        const { tenantName, propertyName, oldRent, newRent, percentage, adjustmentDate } = contractData;

        await resend.emails.send({
            from: 'Passive Income <alerts@resend.dev>',
            to: ['patri.ferrari@gmail.com'],
            subject: `🏠 Ajuste Alquiler: ${propertyName}`,
            html: `
                <h1>Ajuste de Alquiler Detectado</h1>
                <p><strong>Propiedad:</strong> ${propertyName}</p>
                <p><strong>Inquilino:</strong> ${tenantName}</p>
                <p><strong>Fecha Ajuste:</strong> ${adjustmentDate}</p>
                
                <hr />
                
                <p>Según el índice IPC publicado:</p>
                <ul>
                    <li>Alquiler Anterior: <strong>$${oldRent}</strong></li>
                    <li>Porcentaje Ajuste: <strong>${percentage}%</strong></li>
                    <li>Nuevo Alquiler Sugerido: <strong style="color: green; font-size: 1.2em;">$${newRent}</strong></li>
                </ul>
                
                <p><em>Este valor ha sido calculado automáticamente. Por favor confirmar con el inquilino.</em></p>
            `
        });
        console.log(`[Email] Sent contract alert for ${propertyName}`);
    } catch (error) {
        console.error('[Email] Failed to send contract alert:', error);
    }
}
