
import { scrapeAllUtilities } from '@/app/lib/utility-service';
import { updateGlobalAssets, updateTreasuries, updateONs, updateActiveAssetsOnly, updateIPC } from '@/app/lib/market-data';
// import { main as updateDividends } from './scrape-and-update-dividends'; // Assuming it's a script not module
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

const commands = {
    'help': 'Show this help message',
    'check-health': 'Run system health checks',
    'update-prices': 'Update global asset prices (Optimized)',
    'update-smart-home': 'Trigger smart home utility checks',
    'backup': 'Create a database backup (SQLite/Postgres dump)',
    'clean-logs': 'Remove old log files'
};

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log(`\n🚀 Passive Income Tracker CLI`);
    console.log(`=============================\n`);

    if (!command || command === 'help') {
        printHelp();
        return;
    }

    try {
        switch (command) {
            case 'check-health':
                console.log('🏥 Running Health Check...');
                // TODO: Import specific health checks from scripts/debug if needed
                console.log('✅ System seems nominal (Placeholder)');
                break;

            case 'update-prices':
                console.log('💸 Updating Market Prices...');
                console.log('--- IPC ---');
                await updateIPC();

                console.log('--- Active Assets ---');
                // Use the optimized function from market-data
                const result = await updateActiveAssetsOnly();
                console.log(`✅ Updated ${result.count} assets.`);
                break;

            case 'update-smart-home':
                console.log('🏠 Checking Utilities...');
                const homeResults = await scrapeAllUtilities();
                console.log('✅ Smart Home Check Complete.');
                // console.log(JSON.stringify(homeResults, null, 2));
                break;

            case 'backup':
                console.log('💾 Creating Backup...');
                // Implement backup logic here or call a script
                console.log('⚠️  Backup not fully implemented in CLI yet.');
                break;

            case 'clean-logs':
                console.log('🧹 Cleaning logs...');
                // Logic to delete .log files
                console.log('✅ Logs cleaned (Placeholder).');
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                printHelp();
                process.exit(1);
        }
    } catch (error: any) {
        console.error('\n❌ Fatal Error during execution:', error);
        process.exit(1);
    }
}

function printHelp() {
    console.log('Available Commands:');
    for (const [cmd, desc] of Object.entries(commands)) {
        console.log(`  ${cmd.padEnd(20)} ${desc}`);
    }
    console.log('\nUsage: npm run cli <command>');
}

main();
