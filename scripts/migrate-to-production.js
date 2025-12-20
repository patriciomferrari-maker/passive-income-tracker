const fs = require('fs');
const https = require('https');

/**
 * Upload BCRA historical data to production
 * This uses the temporary import endpoint deployed to Vercel
 */
async function migrateToProduction() {
    console.log('🚀 Starting BCRA historical data migration...\n');

    // Read the exported JSON
    const jsonPath = './bcra-historical-export.json';

    console.log(`📖 Reading: ${jsonPath}`);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📦 Loaded ${data.length} records\n`);

    // IMPORTANT: Set your migration secret here
    const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'CHANGE_THIS_SECRET_KEY';
    const PRODUCTION_URL = 'https://passive-income-tracker.vercel.app/api/admin/import-bcra-historical';

    console.log(`🎯 Target: ${PRODUCTION_URL}`);
    console.log(`🔐 Using migration secret: ${MIGRATION_SECRET.substring(0, 4)}...`);
    console.log('⚠️  Make sure MIGRATION_SECRET env variable is set in Vercel!\n');

    // Confirm before proceeding
    console.log('⏳ Starting upload in 3 seconds...');
    console.log('   Press Ctrl+C to cancel\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        console.log('📤 Uploading data to production...');

        const response = await fetch(PRODUCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: data,
                secretKey: MIGRATION_SECRET
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('\n✅ Migration successful!');
            console.log(`📊 Stats:`);
            console.log(`   - Created: ${result.stats.created}`);
            console.log(`   - Updated: ${result.stats.updated}`);
            console.log(`   - Skipped: ${result.stats.skipped}`);
            console.log(`   - Errors: ${result.stats.errors}`);
            console.log(`\n💡 ${result.message}`);
            console.log('\n🗑️  Remember to delete /api/admin/import-bcra-historical after migration!');
        } else {
            console.error('\n❌ Migration failed:');
            console.error(result);
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Upload error:', error.message);
        process.exit(1);
    }
}

// Check if data file exists
if (!fs.existsSync('./bcra-historical-export.json')) {
    console.error('❌ Error: bcra-historical-export.json not found');
    console.error('   Run: npx tsx scripts/export-bcra-historical.ts first');
    process.exit(1);
}

migrateToProduction();
