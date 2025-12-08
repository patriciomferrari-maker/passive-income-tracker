
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        let settings = await prisma.appSettings.findFirst();
        if (!settings) {
            // Default settings
            settings = await prisma.appSettings.create({
                data: {
                    id: "settings", // Enforce single row
                    notificationEmails: "",
                    reportDay: 1,
                    reportHour: 10
                }
            });
        }
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Settings GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { notificationEmails, reportDay, reportHour } = body;

        // Validation
        if (reportDay < 1 || reportDay > 28) {
            return NextResponse.json({ error: 'Day must be between 1 and 28' }, { status: 400 });
        }
        if (reportHour !== undefined && (reportHour < 0 || reportHour > 23)) {
            return NextResponse.json({ error: 'Hour must be between 0 and 23' }, { status: 400 });
        }

        const settings = await prisma.appSettings.upsert({
            where: { id: "settings" },
            update: {
                notificationEmails,
                reportDay,
                reportHour: reportHour || 10
            },
            create: {
                id: "settings",
                notificationEmails,
                reportDay,
                reportHour: reportHour || 10
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Settings PUT Error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
