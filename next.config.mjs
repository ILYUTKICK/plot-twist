/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets CI verify a production build without colliding with an active local
  // dev server's .next directory.
  distDir: process.env.PLOT_TWIST_DIST_DIR || ".next",
};

export default nextConfig;
