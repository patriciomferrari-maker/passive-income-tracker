import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

export interface MetrogasWhatsAppResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

const METROGAS_WHATSAPP = '5491131802222@c.us'; // +54 9 11 3180-2222

export async function checkMetrogasWhatsApp(clientNumber: string): Promise<MetrogasWhatsAppResult> {
    return new Promise((resolve, reject) => {
        console.log(`[Metrogas WhatsApp] Checking account: ${clientNumber}`);

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'metrogas-bot'
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        let conversationStep = 0;
        let timeout: NodeJS.Timeout;

        // QR Code for first-time authentication
        client.on('qr', (qr) => {
            console.log('[Metrogas WhatsApp] Scan QR code:');
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', async () => {
            console.log('[Metrogas WhatsApp] Client ready, starting conversation...');

            try {
                // Step 1: Send client number
                await client.sendMessage(METROGAS_WHATSAPP, clientNumber);
                console.log(`[Metrogas WhatsApp] Sent client number: ${clientNumber}`);

                // Set timeout for conversation
                timeout = setTimeout(() => {
                    client.destroy();
                    resolve({
                        status: 'ERROR',
                        debtAmount: 0,
                        lastBillAmount: null,
                        lastBillDate: null,
                        dueDate: null,
                        errorMessage: 'Conversation timeout'
                    });
                }, 60000); // 60 seconds timeout

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
            // Only process messages from Metrogas
            if (message.from !== METROGAS_WHATSAPP) return;

            const messageText = message.body.toLowerCase();
            console.log(`[Metrogas WhatsApp] Received: ${message.body.substring(0, 100)}...`);

            try {
                // Step 2: Confirm address
                if (conversationStep === 0 && messageText.includes('querés consultar')) {
                    conversationStep = 1;
                    await client.sendMessage(METROGAS_WHATSAPP, 'Sí');
                    console.log('[Metrogas WhatsApp] Confirmed address');
                }
                // Step 3: Parse response
                else if (conversationStep === 1) {
                    clearTimeout(timeout);

                    const result = parseMetrogasResponse(message.body);
                    console.log(`[Metrogas WhatsApp] Result: ${result.status}`);

                    client.destroy();
                    resolve(result);
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
            console.error('[Metrogas WhatsApp] Authentication failed');
            reject(new Error('WhatsApp authentication failed'));
        });

        client.initialize();
    });
}

function parseMetrogasResponse(text: string): MetrogasWhatsAppResult {
    const lowerText = text.toLowerCase();

    // Check for "no tiene deuda" or "ya la pagaste"
    if (lowerText.includes('no tiene deuda') || lowerText.includes('ya la pagaste')) {
        return {
            status: 'UP_TO_DATE',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };
    }

    // Check for debt amount
    const amountMatch = text.match(/\$\s*([\d,.]+)/);
    if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));

        // If there's an amount but also says "ya la pagaste", it's the last bill amount (paid)
        if (lowerText.includes('ya la pagaste')) {
            return {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: amount,
                lastBillDate: null,
                dueDate: null
            };
        }

        // Otherwise it's debt
        return {
            status: 'OVERDUE',
            debtAmount: amount,
            lastBillAmount: amount,
            lastBillDate: null,
            dueDate: null
        };
    }

    // Unknown response
    return {
        status: 'UNKNOWN',
        debtAmount: 0,
        lastBillAmount: null,
        lastBillDate: null,
        dueDate: null,
        errorMessage: 'Could not parse response'
    };
}
