/** @type {import('next').NextConfig} */
// Force rebuild for Node 20 (Amazon Linux 2023 migration)
const nextConfig = {
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // !! WARN !!
        ignoreBuildErrors: true,
    },

    experimental: {
        serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    },
};

export default nextConfig;
