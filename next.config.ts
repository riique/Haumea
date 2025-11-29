import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Geração de site estático para Firebase Hosting
  images: { 
    unoptimized: true, // Necessário para export estático
  },
  
  // Headers de segurança adicionados via firebase.json
};

export default nextConfig;
