/** @type {import('next').NextConfig} */
const nextConfig = {
  // Articles are server-rendered with on-demand revalidation, not static export,
  // since new content arrives continuously via cron.
};

module.exports = nextConfig;
