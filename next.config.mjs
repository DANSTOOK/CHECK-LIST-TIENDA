/** @type {import('next').NextConfig} */
const demo = process.env.NEXT_PUBLIC_DEMO === '1';

const nextConfig = {
  // Paquetes que deben cargarse tal cual en el servidor (no empaquetarse).
  serverExternalPackages: ['@azure/storage-blob', 'pg'],
  // El proyecto no incluye ESLint (el tipado se valida con `npm run typecheck`).
  eslint: { ignoreDuringBuilds: true },
  // Modo demo (GitHub Pages): sitio estático bajo /NOMBRE-DEL-REPO.
  ...(demo && {
    output: 'export',
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    images: { unoptimized: true },
  }),
};
export default nextConfig;
