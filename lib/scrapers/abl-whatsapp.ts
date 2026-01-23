import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

export interface ABLWhatsAppResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

const BOTI_NUMBER = '5491150500147@c.us'; // Boti (CABA)

export async function checkABLWhatsApp(partida: string): Promise<ABLWhatsAppResult> {
    return new Promise((resolve, reject) => {
        console.log(`[ABL WhatsApp] Checking Partida: ${partida}`);

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'boti-client' // Unique session for Boti
            }),
            puppeteer: {
                headless: false, // Visible for debugging/QR scan initially
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
        });

        let conversationStep = 0;
        let timeout: NodeJS.Timeout;

        client.on('qr', (qr) => {
            console.log('\n[ABL WhatsApp] PLEASE SCAN THE QR CODE TO LOGIN:');
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', async () => {
            console.log('[ABL WhatsApp] Client ready, starting conversation with Boti...');

            try {
                // Step 1: Say "Hola" to reset/wake up bot
                await client.sendMessage(BOTI_NUMBER, 'Hola');
                console.log('[ABL WhatsApp] Sent: Hola');

                timeout = setTimeout(() => {
                    client.destroy();
                    resolve({
                        status: 'ERROR',
                        debtAmount: 0,
                        lastBillAmount: null,
                        lastBillDate: null,
                        dueDate: null,
                        errorMessage: 'Conversation timeout (60s)'
                    });
                }, 60000);

            } catch (error: any) {
                clearTimeout(timeout);
                client.destroy();
                resolve({
                    status: 'ERROR',
                    debtAmount: 0,
                    lastBillAmount: null,
                    lastBillDate: null,
                    dueDate: null,
                    errorMessage: error.message
                });
            }
        });

        client.on('message', async (message) => {
            if (message.from !== BOTI_NUMBER) return;

            const text = message.body.toLowerCase();
            console.log(`[ABL WhatsApp] Boti said: ${message.body.substring(0, 100).replace(/\n/g, ' ')}...`);

            try {
                // Logic Flow:
                // 0. Initial State (Wait for greeting/menu) -> Send "ABL"
                // 1. Wait for "Partida" prompt -> Send Partida number
                // 2. Wait for Result -> Parse & Finish

                // NOTE: Boti is complex. We need to be robust.
                // It usually responds with a menu or "Soy Boti..."

                if (conversationStep === 0) {
                    // We just sent "Hola". Waiting for ANY response to send "ABL".
                    // Boti might send multiple messages (Greeting + Menu). 
                    // We'll wait a split second or just reply to the first one?
                    // Better to wait for specific keywords or just force the command.

                    console.log('[ABL WhatsApp] Sending command: ABL');
                    await new Promise(r => setTimeout(r, 2000)); // Small delay to let messages arrive
                    await client.sendMessage(BOTI_NUMBER, 'ABL');
                    conversationStep = 1;
                }
                else if (conversationStep === 1) {
                    // We sent "ABL". Waiting for it to ask for the Partida.
                    if (text.includes('partida') || text.includes('dv') || text.includes('ingresá')) {
                        console.log(`[ABL WhatsApp] Sending Partida: ${partida}`);
                        await new Promise(r => setTimeout(r, 1000));
                        await client.sendMessage(BOTI_NUMBER, partida);
                        conversationStep = 2;
                    }
                    // Handle "No te entendí" or logic retry?
                }
                else if (conversationStep === 2) {
                    // We sent Partida. Waiting for Result.
                    // Result likely contains "$" or "no registrás deuda".

                    if (text.includes('total a pagar') || text.includes('saldo') || text.includes('deuda') ||
                        text.includes('al día') || text.includes('$')) {

                        clearTimeout(timeout);
                        const result = parseBotiResponse(message.body);
                        console.log(`[ABL WhatsApp] Final Result: ${result.status} - $${result.debtAmount}`);

                        // Give it a second to finish logging then close
                        setTimeout(() => {
                            client.destroy();
                            resolve(result);
                        }, 2000);

                        conversationStep = 3; // Done
                    }
                }

            } catch (error: any) {
                clearTimeout(timeout);
                client.destroy();
                resolve({
                    status: 'ERROR',
                    debtAmount: 0,
                    lastBillAmount: null,
                    lastBillDate: null,
                    dueDate: null,
                    errorMessage: error.message
                });
            }
        });

        client.on('auth_failure', () => {
            console.error('[ABL WhatsApp] Auth failure');
            reject(new Error('WhatsApp authentication failed'));
        });

        client.initialize();
    });
}

function parseBotiResponse(text: string): ABLWhatsAppResult {
    const lower = text.toLowerCase();

    // Heuristic for no debt
    if (lower.includes('no tenés deuda') || lower.includes('al día') || lower.includes('no registra deuda')) {
        return {
            status: 'UP_TO_DATE',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };
    }

    // Heuristic for debt
    // Look for currency format: $ 1.234,56
    const amountMatch = text.match(/\$\s*([\d,.]+)/);
    if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
        return {
            status: 'OVERDUE', // Assume overdue if it shows a payable amount? Or just "Pending Bill"?
            // For now, treat any payable amount as 'debt' or 'to pay'.
            debtAmount: amount,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };
    }

    return {
        status: 'UNKNOWN',
        debtAmount: 0,
        lastBillAmount: null,
        lastBillDate: null,
        dueDate: null,
        errorMessage: 'Parsing failed: ' + text.substring(0, 50)
    };
}
