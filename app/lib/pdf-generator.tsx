import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { MonthlyReportPdf } from '@/components/pdf/MonthlyReportPdf';
import { RentalsReportPdf } from '@/components/pdf/RentalsReportPdf';
import { InvestmentsReportPdf } from '@/components/pdf/InvestmentsReportPdf';

// Legacy Single Report (Optional)
export async function generateMonthlyReportPdfBuffer(data: any, enabledSections: string[]) {
    return await renderToBuffer(<MonthlyReportPdf data={data} enabledSections={enabledSections} />);
}

// Rentals Report
export async function generateRentalsPdfBuffer(data: any) {
    return await renderToBuffer(<RentalsReportPdf data={data} />);
}

// Investments Report
export async function generateInvestmentsPdfBuffer(data: any) {
    return await renderToBuffer(<InvestmentsReportPdf data={data} />);
}

