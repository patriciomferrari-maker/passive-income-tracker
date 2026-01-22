import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

export interface AysaWhatsAppResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

const AYSA_WHATSAPP = '5491151992900@c.us'; // +54 9 11 5199-2900

export async function checkAysaWhatsApp(clientNumber: string): Promise<AysaWhatsAppResult> {
    return new Promise((resolve, reject) => {
        console.log(`[AYSA WhatsApp] Checking account: ${clientNumber}`);

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'aysa-bot'
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
            console.log('[AYSA WhatsApp] Scan QR code:');
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', async () => {
            console.log('[AYSA WhatsApp] Client ready, starting conversation...');

            try {
                // Step 1: Send client number
                await client.sendMessage(AYSA_WHATSAPP, clientNumber);
                console.log(`[AYSA WhatsApp] Sent client number: ${clientNumber}`);

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
            // Only process messages from AYSA
            if (message.from !== AYSA_WHATSAPP) return;

            const messageText = message.body.toLowerCase();
            console.log(`[AYSA WhatsApp] Received: ${message.body.substring(0, 100)}...`);

            try {
                // Step 2: Handle initial response (may ask for confirmation)
                if (conversationStep === 0 && (messageText.includes('confirma') || messageText.includes('correcto'))) {
                    conversationStep = 1;
                    await client.sendMessage(AYSA_WHATSAPP, 'Sí');
                    console.log('[AYSA WhatsApp] Confirmed account');
                }
                // Step 3: Parse final response with debt status
                else if (conversationStep === 1 || (conversationStep === 0 && (messageText.includes('deuda') || messageText.includes('factura')))) {
                    clearTimeout(timeout);

                    const result = parseAysaResponse(message.body);
                    console.log(`[AYSA WhatsApp] Result: ${result.status}`);

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
            console.error('[AYSA WhatsApp] Authentication failed');
            reject(new Error('WhatsApp authentication failed'));
        });

        client.initialize();
    });
}

function parseAysaResponse(text: string): AysaWhatsAppResult {
    const lowerText = text.toLowerCase();

    // Check for "sin deuda" or "no registra deuda"
    if (lowerText.includes('sin deuda') || lowerText.includes('no registra deuda') || lowerText.includes('al día')) {
        return {
            status: 'UP_TO_DATE',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };
    }

    // Check for debt amount - AYSA typically uses format like "$1.234,56" or "$ 1234.56"
    const amountMatch = text.match(/\$\s*([\d,.]+)/);
    if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));

        // If there's an amount and mentions "vencida" or "adeuda", it's debt
        if (lowerText.includes('vencida') || lowerText.includes('adeuda') || lowerText.includes('deuda')) {
            return {
                status: 'OVERDUE',
                debtAmount: amount,
                lastBillAmount: amount,
                lastBillDate: null,
                dueDate: null
            };
        }

        // If there's an amount but says "pagada" or "abonada", it's paid
        if (lowerText.includes('pagada') || lowerText.includes('abonada')) {
            return {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: amount,
                lastBillDate: null,
                dueDate: null
            };
        }

        // Default to debt if amount is present
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
