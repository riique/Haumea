import { onRequest } from 'firebase-functions/v2/https';
import { configureCORS } from '../middleware/cors';

export const healthCheck = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  async (req, res) => {
    if (configureCORS(req, res)) return;
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }
);
