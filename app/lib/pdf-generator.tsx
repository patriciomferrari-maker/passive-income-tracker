import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { MonthlyReportPdf } from '@/components/pdf/MonthlyReportPdf';

export async function generateMonthlyReportPdfBuffer(
    data: any,
    enabledSections: string[]
) {
    return await renderToBuffer(
        <MonthlyReportPdf data={data} enabledSections={enabledSections} />
    );
}
