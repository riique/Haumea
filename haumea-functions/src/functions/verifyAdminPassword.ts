import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface VerifyAdminPasswordData {
  password: string;
}

// Senha de administrador - ALTERE ISSO!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'haumea2025';

export const verifyAdminPassword = onCall<VerifyAdminPasswordData>(
  {
    memory: '128MiB',
    timeoutSeconds: 5,
  },
  async (request) => {
    const { password } = request.data;

    // Verificar autenticação
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    if (!password) {
      throw new HttpsError('invalid-argument', 'Senha não fornecida');
    }

    const isValid = password === ADMIN_PASSWORD;

    return { valid: isValid };
  }
);
