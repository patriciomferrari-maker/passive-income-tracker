
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
