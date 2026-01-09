/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'automationalien.s3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

}

export default nextConfig
