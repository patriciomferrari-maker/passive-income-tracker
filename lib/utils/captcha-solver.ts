import axios from 'axios';
import { Page, Frame } from 'puppeteer';

/**
 * Solves a reCAPTCHA v2 audio challenge using Wit.ai for transcription.
 * @param page The Puppeteer page instance.
 */
export async function solveAudioCaptcha(page: Page): Promise<boolean> {
    const WIT_AI_TOKEN = process.env.WIT_AI_TOKEN;

    if (!WIT_AI_TOKEN) {
        console.warn('⚠️  WIT_AI_TOKEN is not set. Audio captcha solver will fail.');
        return false;
    }

    try {
        console.log('🎙️  Starting audio CAPTCHA solver...');

        // 1. Find the frame with the audio button
        let challengeFrame: Frame | null = null;
        let audioButton = null;
        let box = null;

        // Try for up to 10 seconds to find the VISIBLE audio button in any reCAPTCHA frame
        for (let i = 0; i < 10; i++) {
            const frames = page.frames();
            for (const frame of frames) {
                if (frame.url().includes('google.com/recaptcha')) {
                    const btn = await frame.$('#recaptcha-audio-button');
                    if (btn) {
                        const bounds = await btn.boundingBox();
                        if (bounds && bounds.width > 0 && bounds.height > 0) {
                            // Check if the frame itself is likely visible (not hidden)
                            const isFrameVisible = await page.evaluate((url) => {
                                const iframes = Array.from(document.querySelectorAll('iframe'));
                                const myIframe = iframes.find(f => f.src.includes(url));
                                if (!myIframe) return false;
                                const style = window.getComputedStyle(myIframe);
                                return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
                            }, frame.url()).catch(() => true);

                            if (isFrameVisible) {
                                audioButton = btn;
                                challengeFrame = frame;
                                box = bounds;
                                break;
                            }
                        }
                    }
                }
            }
            if (challengeFrame) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!challengeFrame || !audioButton || !box) {
            console.warn('❌ Visible audio button not found in any reCAPTCHA frame.');
            return false;
        }

        console.log(`   Found active challenge frame: ${challengeFrame.url()}`);
        console.log(`   Button bounds: ${JSON.stringify(box)}`);

        // Save a debug screenshot before interaction
        const timestamp = Date.now();
        const preClickPath = `C:\\Users\\patri\\.gemini\\antigravity\\brain\\381ed150-479b-4539-8196-e99f3824d92b\\debug_before_${timestamp}.png`;
        await page.screenshot({ path: preClickPath, fullPage: true });
        console.log(`📸  Pre-click screenshot (FULL PAGE): ${preClickPath}`);

        // Human-like behavior
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

        console.log('   Clicking audio challenge button...');
        // Move to the button center
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
        await new Promise(r => setTimeout(r, 500));
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        await new Promise(r => setTimeout(r, 4000));

        const postClickPath = `C:\\Users\\patri\\.gemini\\antigravity\\brain\\381ed150-479b-4539-8196-e99f3824d92b\\debug_post_${timestamp}.png`;
        await page.screenshot({ path: postClickPath });
        console.log(`📸  Post-click screenshot: ${postClickPath}`);

        // Check if we hit the "Try again later" block
        const isBlocked = await challengeFrame.evaluate(() => {
            const body = document.body.innerText.toLowerCase();
            return body.includes('inténtalo de nuevo más tarde') ||
                body.includes('try again later') ||
                body.includes('automated queries') ||
                body.includes('solicitudes automáticas');
        });

        if (isBlocked) {
            console.warn('❌ Google is blocking audio challenges: "Try again later".');
            return false;
        }

        // 2. Get audio download link with retries
        console.log(`   Searching for audio download link in frame: ${challengeFrame.url()}`);

        let audioUrl = null;
        for (let i = 0; i < 5; i++) {
            audioUrl = await challengeFrame.evaluate(() => {
                const anchor = document.querySelector('.rc-audiochallenge-tdownload-link, a[href*="audio/payload"]') as HTMLAnchorElement;
                if (anchor) return anchor.href;

                const audio = document.querySelector('audio') as HTMLAudioElement;
                if (audio) return audio.src;

                return null;
            });

            if (audioUrl) break;
            console.log(`   Attempt ${i + 1}: Link not found yet...`);
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!audioUrl) {
            console.warn('❌ Still could not find audio download URL after retries.');
            return false;
        }

        console.log('   Downloading audio challenge...');

        // 3. Download the audio file
        const response = await axios({
            url: audioUrl,
            method: 'GET',
            responseType: 'arraybuffer'
        });

        console.log('   Transcribing audio via Wit.ai...');

        // 4. Send to Wit.ai for transcription
        const witResponse = await axios({
            url: 'https://api.wit.ai/speech',
            method: 'POST',
            params: {
                v: '20230215'
            },
            headers: {
                'Authorization': `Bearer ${WIT_AI_TOKEN}`,
                'Content-Type': 'audio/mpeg3'
            },
            data: response.data
        });

        // Wit.ai response handling
        let transcript = '';
        if (typeof witResponse.data === 'string') {
            const lines = witResponse.data.split('\n').filter((l: string) => l.trim());
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.text) transcript = parsed.text;
                } catch (err) { }
            }
        } else if (witResponse.data && witResponse.data.text) {
            transcript = witResponse.data.text;
        }

        if (!transcript) {
            console.warn('❌ Wit.ai could not transcribe the audio.');
            return false;
        }

        console.log(`   Transcription result: "${transcript}"`);

        // 5. Type the result and verify
        await challengeFrame.type('#audio-response', transcript, { delay: 100 });
        await new Promise(r => setTimeout(r, 500));

        const verifyButton = await challengeFrame.$('#recaptcha-verify-button');
        if (verifyButton) {
            console.log('   Clicking Verify...');
            await verifyButton.click();
            await new Promise(r => setTimeout(r, 2000));
        }

        // Check if solved (all frames should be checked for success indicator)
        const isSolved = await page.evaluate(() => {
            const checkbox = document.querySelector('.recaptcha-checkbox[aria-checked="true"]');
            return !!checkbox;
        });

        if (isSolved) {
            console.log('🏛️ [Audio Solver] Success! CAPTCHA solved.');
        } else {
            console.warn('🏛️ [Audio Solver] Finished but reCAPTCHA checkbox is not checked.');
        }

        return isSolved;

    } catch (error: any) {
        console.error('❌ Error solving audio captcha:', error.message);
        return false;
    }
}
