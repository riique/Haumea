import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';

// Configure your allowed origins here
// Add your production domain and Firebase hosting URL
const ALLOWED_ORIGINS = [
  // Production domains (update these with your own)
  // 'https://yourdomain.com',
  // 'https://www.yourdomain.com',
  // 'https://your-project.web.app',
  
  // Development
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  
  // Add custom origins from environment variable
  ...(process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []),
];

export function configureCORS(req: Request, res: Response): boolean {
  const origin = req.headers.origin;
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24h
  
  // Expor headers para streaming
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Cache-Control, Connection');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  
  return false;
}
