import puppeteer from 'puppeteer';

async function probeAysa() {
    console.log('🕵️ Probing AYSA portal...');
    const browser = await puppeteer.launch({
        headless: false, // Visible so you can see
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page = await browser.newPage();

        // Try the main portal
        console.log('Navigating to AYSA Oficina Virtual...');
        await page.goto('https://oficinavirtual.web.aysa.com.ar/', { waitUntil: 'networkidle0' });

        console.log('✅ Page loaded.');
        console.log('📸 Taking screenshot...');
        await page.screenshot({ path: 'aysa-portal.png', fullPage: true });

        // Log all links and buttons text to see what's available
        const interactables = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, input[type="submit"]'));
            return elements.map(el => ({
                text: el.textContent?.trim(),
                href: (el as HTMLAnchorElement).href
            })).filter(item => item.text);
        });

        console.log('\n🔗 Interactable elements found:');
        interactables.forEach(i => console.log(`- ${i.text} (${i.href || 'button'})`));

        console.log('\n⚠️  Keeping browser open for 30 seconds for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 30000));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

probeAysa();
