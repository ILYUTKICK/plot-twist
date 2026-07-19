/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev owns .next; production scripts use .next-build so their assets never
  // overwrite an active local server.
  distDir: process.env.PLOT_TWIST_DIST_DIR || ".next",
};

export default nextConfig;
