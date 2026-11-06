import type { NextConfig } from 'next';

const config: NextConfig = {
  // Los paquetes internos se consumen como fuente TS: Next los transpila en el build.
  transpilePackages: ['@escenai/core', '@escenai/adapters'],
  reactStrictMode: true,
  // El indicador de desarrollo tapaba la UI en las capturas de revisión.
  devIndicators: false,
};

export default config;
