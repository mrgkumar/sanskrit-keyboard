const repoName = 'sanskrit-keyboard';
const basePath = `/${repoName}`;
const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isProduction ? basePath : '',
  },
};

if (isProduction) {
  nextConfig.basePath = basePath;
  nextConfig.assetPrefix = `${basePath}/`;
}

export default nextConfig;
