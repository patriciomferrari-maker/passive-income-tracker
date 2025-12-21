// Fetch historical USD Blue rates from Ambito.com
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const { startDate, endDate } = await request.json();

        // Default to from 2015 to match IPC data range
        const start = startDate || '2015-01-01';
        const end = endDate || new Date().toISOString().split('T')[0];

        // Fetch from Ambito
        const url = `https://mercados.ambito.com//dolar/informal/historico-general/${start}/${end}`;

        console.log('Fetching from:', url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Ambito API returned ${response.status}`);
        }

        const textData = await response.text();

        console.log('Raw response length:', textData.length);
        console.log('First 300 chars:', textData.substring(0, 300));

        // Parse the data - Ambito can return different formats
        let parsedData: any[] = [];

        // Try multiple parsing strategies
        try {
            // Strategy 1: Direct JSON parse
            parsedData = JSON.parse(textData);
            console.log('Strategy 1 (direct parse) succeeded');
        } catch {
            try {
                // Strategy 2: Clean and parse
                let cleanData = textData.trim()
                    .replace(/^[^\[]*/, '')
                    .replace(/[^\]]*$/, '');
                parsedData = JSON.parse(cleanData);
                console.log('Strategy 2 (cleaned parse) succeeded');
            } catch {
                // Strategy 3: Extract JSON array pattern
                const match = textData.match(/\[\s*\[[\s\S]*?\]\s*\]/);
                if (match) {
                    parsedData = JSON.parse(match[0]);
                    console.log('Strategy 3 (regex extract) succeeded');
                } else {
                    console.error('Could not find array pattern in response');
                    throw new Error('Cannot parse Ambito response format');
                }
            }
        }

        if (!Array.isArray(parsedData)) {
            console.error('Parsed data type:', typeof parsedData);
            throw new Error('Parsed data is not an array');
        }

        console.log(`Found ${parsedData.length} raw entries`);

        // Convert to our format and save
        const records = [];

        for (const entry of parsedData) {
            try {
                // Handle different entry formats
                let dateStr: string;
                let compra: number | undefined;
                let venta: number | undefined;

                if (Array.isArray(entry)) {
                    // Array format: [date, compra, venta] or [date, promedio]
                    dateStr = entry[0];

                    if (entry.length === 3) {
                        // Has compra and venta
                        compra = parseFloat(String(entry[1]).replace(',', '.'));
                        venta = parseFloat(String(entry[2]).replace(',', '.'));
                    } else if (entry.length === 2) {
                        // Only has one value (already averaged or single rate)
                        venta = parseFloat(String(entry[1]).replace(',', '.'));
                    }
                } else if (typeof entry === 'object') {
                    // Object format: {fecha, compra, venta} or similar
                    dateStr = entry.fecha || entry.date;
                    compra = entry.compra ? parseFloat(String(entry.compra).replace(',', '.')) : undefined;
                    venta = entry.venta ? parseFloat(String(entry.venta).replace(',', '.')) : undefined;
                } else {
                    console.log('Skipping invalid entry:', entry);
                    continue;
                }

                // Parse date - handle DD-MM-YYYY and YYYY-MM-DD
                let date: Date;
                const dateParts = dateStr.split(/[-/]/);

                if (dateParts.length === 3) {
                    if (dateParts[0].length === 4) {
                        // YYYY-MM-DD
                        date = new Date(`${dateParts[0]}-${dateParts[1]}-${dateParts[2]}T12:00:00Z`);
                    } else {
                        // DD-MM-YYYY
                        date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T12:00:00Z`);
                    }
                } else {
                    continue;
                }

                // Calculate average rate
                let rate: number;
                if (compra !== undefined && venta !== undefined && !isNaN(compra) && !isNaN(venta)) {
                    // Calculate average of buy and sell
                    rate = (compra + venta) / 2;
                } else if (venta !== undefined && !isNaN(venta)) {
                    // Use venta if compra not available
                    rate = venta;
                } else {
                    continue;
                }

                if (isNaN(rate) || rate <= 0 || isNaN(date.getTime())) {
                    continue;
                }

                records.push({
                    type: 'TC_USD_ARS',
                    date,
                    value: rate,
                    buyRate: compra,
                    sellRate: venta
                });
            } catch (err) {
                console.error(`Error parsing entry:`, entry, err);
            }
        }

        console.log(`Successfully parsed ${records.length} valid records`);

        if (records.length === 0) {
            throw new Error('No valid records found in Ambito data');
        }

        // Bulk upsert using our existing logic
        let created = 0;
        let updated = 0;

        for (const record of records) {
            // Create range for finding existing records on the same day (ignore time)
            const dayStart = new Date(record.date);
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(record.date);
            dayEnd.setUTCHours(23, 59, 59, 999);

            const existing = await prisma.economicIndicator.findFirst({
                where: {
                    type: record.type,
                    date: {
                        gte: dayStart,
                        lte: dayEnd
                    }
                }
            });

            if (existing) {
                await prisma.economicIndicator.update({
                    where: { id: existing.id },
                    data: {
                        date: record.date, // Update date to new Noon standard
                        value: record.value,
                        buyRate: record.buyRate,
                        sellRate: record.sellRate
                    }
                });
                updated++;
            } else {
                await prisma.economicIndicator.create({
                    data: record
                });
                created++;
            }
        }

        return NextResponse.json({
            success: true,
            source: 'Ambito.com (promedio compra/venta)',
            dateRange: { start, end },
            totalRecords: records.length,
            created,
            updated,
            message: `Importados ${created} nuevos registros, actualizados ${updated} existentes`
        });

    } catch (error) {
        console.error('Error fetching from Ambito:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch from Ambito',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
