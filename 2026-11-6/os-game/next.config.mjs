/** @type {import('next').NextConfig} */
const nextConfig = {
    // Keep development output separate from production builds. Sharing one
    // directory makes the dev server load missing or stale webpack chunks.
    distDir: process.env.NODE_ENV === 'production' ? 'dist' : '.next',
    // The generated template has no local ESLint dependency. TypeScript still runs during build.
    eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
