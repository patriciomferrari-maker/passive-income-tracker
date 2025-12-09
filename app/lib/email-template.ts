
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

    // Header Metrics
    totalNetWorth: number;
    totalArg: number;     // Cartera Arg (ONs)
    totalUSA: number;     // Cartera USA (Treasuries)

    // Details
    maturities: MaturityItem[];

    // Highlights
    nextRentalExpiration?: { date: Date; property: string } | null;
    nextRentalAdjustment?: { date: Date; property: string } | null;
    nextPFMaturity?: { date: Date; bank: string; amount: number } | null;
}

export function generateMonthlyReportEmail(data: MonthlyReportData): string {
    const {
        userName, month, year,
        totalNetWorth, totalArg, totalUSA,
        maturities,
        nextRentalExpiration, nextRentalAdjustment, nextPFMaturity
    } = data;

    // Filter maturities for "This Month" (The requested "Vencimientos del mes" covers the whole month usually)
    const today = new Date();
    // Show all future maturities
    const upcomingMaturities = maturities.filter(m => m.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());

    const renderRows = (items: MaturityItem[]) => {
        if (items.length === 0) return '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">No hay más vencimientos este mes.</td></tr>';

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
                <td colspan="2" style="padding: 12px 0; text-align: right; color: #64748b; font-size: 13px; text-transform: uppercase;">Total Estimado (USD)</td>
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
                Hola <strong>${userName}</strong>, aquí están tus números de hoy:
            </p>

            <!-- Dashboard Summary Cards (3 Columns) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                    <td width="32%" style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600;">Cartera Arg</p>
                        <p style="margin: 4px 0 0; color: #0f172a; font-size: 16px; font-weight: 700;">${formatCurrency(totalArg, 'USD')}</p>
                    </td>
                    <td width="2%"></td>
                    <td width="32%" style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600;">Cartera USA</p>
                        <p style="margin: 4px 0 0; color: #0f172a; font-size: 16px; font-weight: 700;">${formatCurrency(totalUSA, 'USD')}</p>
                    </td>
                    <td width="2%"></td>
                    <td width="32%" style="background-color: #ecfdf5; padding: 12px; border-radius: 8px; border: 1px solid #a7f3d0; text-align: center;">
                        <p style="margin: 0; color: #047857; font-size: 10px; text-transform: uppercase; font-weight: 600;">Patrimonio</p>
                        <p style="margin: 4px 0 0; color: #059669; font-size: 16px; font-weight: 700;">${formatCurrency(totalNetWorth, 'USD')}</p>
                    </td>
                </tr>
            </table>

            <!-- Section: Maturities -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Próximos Vencimientos (${month})</h3>
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
                            ${renderRows(upcomingMaturities)}
                            ${renderTotal(upcomingMaturities)}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Section: Key Dates (Highlights) -->
             <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Próximos Eventos</h3>
                </div>
                <div style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${nextRentalExpiration ? `
                        <tr>
                            <td style="padding-bottom: 8px; color: #64748b; font-size: 12px;">Vencimiento Alquiler</td>
                            <td style="padding-bottom: 8px; color: #0f172a; font-weight: 500; text-align: right;">
                                ${format(nextRentalExpiration.date, 'dd/MM/yyyy')} <span style="color: #64748b; font-size: 11px;">(${nextRentalExpiration.property})</span>
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${nextRentalAdjustment ? `
                        <tr>
                            <td style="padding-bottom: 8px; color: #64748b; font-size: 12px;">Próximo Ajuste Alquiler</td>
                            <td style="padding-bottom: 8px; color: #0f172a; font-weight: 500; text-align: right;">
                                ${format(nextRentalAdjustment.date, 'dd/MM/yyyy')} <span style="color: #64748b; font-size: 11px;">(${nextRentalAdjustment.property})</span>
                            </td>
                        </tr>
                        ` : ''}

                         ${nextPFMaturity ? `
                        <tr>
                            <td style="padding-bottom: 0; color: #64748b; font-size: 12px;">Vencimiento Plazo Fijo</td>
                            <td style="padding-bottom: 0; color: #0f172a; font-weight: 500; text-align: right;">
                                ${format(nextPFMaturity.date, 'dd/MM/yyyy')} <span style="color: #64748b; font-size: 11px;">(${nextPFMaturity.bank})</span>
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${!nextRentalExpiration && !nextRentalAdjustment && !nextPFMaturity ? `
                            <tr><td colspan="2" style="text-align: center; color: #94a3b8; font-size: 12px;">No hay eventos destacados próximos.</td></tr>
                        ` : ''}
                    </table>
                </div>
            </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 24px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">Passive Income Tracker</p>
        </div>

    </div>
</body>
</html>
    `;
}
