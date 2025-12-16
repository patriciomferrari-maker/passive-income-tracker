import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const userId = 'cmixkx9xi0000o235ll480bf3'; // The user's ID

    // Fetch current settings
    const settings = await prisma.appSettings.findUnique({
        where: { userId }
    });

    if (!settings) {
        console.log('No settings found for user.');
        return;
    }

    console.log('Current sections:', settings.enabledSections);

    let currentSections = settings.enabledSections ? settings.enabledSections.split(',') : [];

    // Add 'costa' if missing
    if (!currentSections.includes('costa')) {
        currentSections.push('costa');
    }

    // Add 'rentals' if missing (usually they go together or are related)
    if (!currentSections.includes('rentals')) {
        currentSections.push('rentals');
    }

    const newSectionsStr = currentSections.join(',');

    await prisma.appSettings.update({
        where: { userId },
        data: { enabledSections: newSectionsStr }
    });

    console.log('Updated sections:', newSectionsStr);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
