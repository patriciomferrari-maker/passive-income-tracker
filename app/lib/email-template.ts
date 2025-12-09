
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = (val: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(val);
};

interface MaturityItem {
    date: Date;
    description: string;
    amount: number;
    currency: string;
    type: 'ON' | 'TREASURY' | 'RENTAL' | 'PF' | 'OTHER';
}

interface MonthlyReportData {
    userName: string;
    month: string;
    year: string;
    dashboardUrl: string;

    // Header Metrics
    totalDebtPending: number; // Was totalNetWorth
    totalArg: number;
    totalUSA: number;

    // Details
    maturities: MaturityItem[];

    // Highlights
    rentalEvents: {
        nextExpiration?: { date: Date; property: string } | null;
        nextAdjustment?: { date: Date; property: string } | null;
    };

    nextPFMaturity?: { date: Date; bank: string; amount: number } | null;
}

export function generateMonthlyReportEmail(data: MonthlyReportData): string {
    const {
        userName, month, year, dashboardUrl,
        totalDebtPending, totalArg, totalUSA,
        maturities,
        rentalEvents, nextPFMaturity
    } = data;

    // Sort by date (showing entire month as requested)
    const sortedMaturities = [...maturities].sort((a, b) => a.date.getTime() - b.date.getTime());

    const renderRows = (items: MaturityItem[]) => {
        if (items.length === 0) return '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">No hay movimientos este mes.</td></tr>';

        return items.map(item => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #334155;">
                    ${format(item.date, 'dd/MM', { locale: es })}
                </td>
                <td style="padding: 12px 0; color: #0f172a; font-weight: 500;">
                    ${item.description}
                </td>
                <td style="padding: 12px 0; text-align: right; color: #0f172a; font-weight: 600;">
                    ${formatCurrency(item.amount, item.currency)}
                </td>
            </tr>
        `).join('');
    };

    const renderTotal = (items: MaturityItem[]) => {
        if (items.length === 0) return '';
        const total = items.reduce((sum, i) => sum + i.amount, 0);
        return `
            <tr>
                <td colspan="2" style="padding: 12px 0; text-align: right; color: #64748b; font-size: 13px; text-transform: uppercase;">Total del Mes (USD)</td>
                <td style="padding: 12px 0; text-align: right; color: #0e4166; font-weight: 700;">${formatCurrency(total, 'USD')}</td>
            </tr>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resumen Mensual</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

    <!-- Main Container -->
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden; font-size: 14px;">
        
        <!-- Header -->
        <div style="background-color: #0e4166; padding: 30px 24px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Resumen Mensual</h1>
            <p style="margin: 5px 0 0; color: #94a3b8; font-size: 14px;">${month.toUpperCase()} ${year}</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px;">
            
            <p style="margin: 0 0 24px; color: #334155; font-size: 16px;">
                Hola <strong>${userName}</strong>, este es tu resumen:
            </p>

            <!-- 1. Cards: Arg | USA | Deudas -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                    <td width="32%" style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600;">Cartera Arg</p>
                        <p style="margin: 4px 0 0; color: #0f172a; font-size: 15px; font-weight: 700;">${formatCurrency(totalArg, 'USD')}</p>
                    </td>
                    <td width="2%"></td>
                    <td width="32%" style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600;">Cartera USA</p>
                        <p style="margin: 4px 0 0; color: #0f172a; font-size: 15px; font-weight: 700;">${formatCurrency(totalUSA, 'USD')}</p>
                    </td>
                    <td width="2%"></td>
                    <td width="32%" style="background-color: #fff1f2; padding: 12px; border-radius: 8px; border: 1px solid #fecdd3; text-align: center;">
                        <p style="margin: 0; color: #be123c; font-size: 10px; text-transform: uppercase; font-weight: 600;">Deudas a Cobrar</p>
                        <p style="margin: 4px 0 0; color: #be123c; font-size: 15px; font-weight: 700;">${formatCurrency(totalDebtPending, 'USD')}</p>
                    </td>
                </tr>
            </table>

            <!-- 2. Vencimientos del Mes (Full Month) -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Vencimientos del Mes (${month})</h3>
                </div>
                <div style="padding: 0 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 12px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">Fecha</th>
                                <th style="text-align: left; padding: 12px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">Concepto</th>
                                <th style="text-align: right; padding: 12px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderRows(sortedMaturities)}
                            ${renderTotal(sortedMaturities)}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 3. Alquileres Tables (Prox Ajuste & Vencimiento) -->
             <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Alquileres - Próximos Eventos</h3>
                </div>
                <div style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${rentalEvents.nextAdjustment ? `
                        <tr>
                            <td style="padding-bottom: 8px; color: #64748b; font-size: 12px;">Próximo Ajuste</td>
                            <td style="padding-bottom: 8px; color: #0f172a; font-weight: 500; text-align: right;">
                                ${format(rentalEvents.nextAdjustment.date, 'dd/MM/yyyy')} 
                                <span style="display:block; color: #64748b; font-size: 11px;">${rentalEvents.nextAdjustment.property}</span>
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${rentalEvents.nextExpiration ? `
                        <tr>
                            <td style="padding-bottom: 0px; color: #64748b; font-size: 12px;">Vencimiento Contrato</td>
                            <td style="padding-bottom: 0px; color: #0f172a; font-weight: 500; text-align: right;">
                                ${format(rentalEvents.nextExpiration.date, 'dd/MM/yyyy')}
                                <span style="display:block; color: #64748b; font-size: 11px;">${rentalEvents.nextExpiration.property}</span>
                            </td>
                        </tr>
                        ` : ''}

                        ${!rentalEvents.nextAdjustment && !rentalEvents.nextExpiration ? `
                            <tr><td colspan="2" style="text-align: center; color: #94a3b8; font-size: 12px;">No hay eventos de alquiler próximos.</td></tr>
                        ` : ''}
                    </table>
                </div>
            </div>
            
            <!-- 4. Next PF Maturity (Optional) -->
            ${nextPFMaturity ? `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                     <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Próximo Vencimiento Plazo Fijo</h3>
                </div>
                <div style="padding: 16px;">
                     <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="color: #64748b; font-size: 12px;">${nextPFMaturity.bank}</td>
                            <td style="color: #0f172a; font-weight: 500; text-align: right;">
                                ${format(nextPFMaturity.date, 'dd/MM/yyyy')}
                                <span style="display:block; color: #0e4166; font-weight: 700;">${formatCurrency(nextPFMaturity.amount, 'ARS')}</span>
                            </td>
                        </tr>
                     </table>
                </div>
            </div>
            ` : ''}

            <!-- CTA Button -->
             <div style="text-align: center; margin-top: 32px;">
                <a href="${dashboardUrl}" style="background-color: #0e4166; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Ir al Dashboard Consolidado</a>
                <p style="margin-top: 16px; color: #94a3b8; font-size: 12px;">Para mas información visita tu panel de control.</p>
            </div>

        </div>

    </div>
</body>
</html>
    `;
}
