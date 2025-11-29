'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle, XCircle, Share2, ArrowRight } from 'lucide-react';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { logger } from '@/lib/utils/logger';

type InviteStatus = 'loading' | 'success' | 'error' | 'unauthenticated';

interface AcceptInviteResult {
  success: boolean;
  chatId: string;
  shareType: 'copy' | 'collaborative';
  chatName: string;
  message: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [message, setMessage] = useState('');

  const acceptInvite = useCallback(async (code: string) => {
    try {
      setStatus('loading');
      setMessage('Processando convite...');

      const acceptShareInviteFn = httpsCallable<{ inviteCode: string }, AcceptInviteResult>(
        functions,
        'acceptShareInvite'
      );

      const result = await acceptShareInviteFn({ inviteCode: code });
      const data = result.data;

      if (data.success) {
        setStatus('success');
        setMessage(data.message);

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('Erro ao processar convite.');
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      logger.error('Error accepting invite:', { error: err.message });
      
      let errorMessage = 'Erro ao aceitar convite. Tente novamente.';
      
      if (err.code === 'functions/not-found') {
        errorMessage = 'Convite inválido ou expirado.';
      } else if (err.code === 'functions/already-exists') {
        errorMessage = 'Você já aceitou este convite.';
      } else if (err.code === 'functions/failed-precondition') {
        errorMessage = err.message || 'Este convite não pode ser aceito.';
      } else if (err.code === 'functions/unauthenticated') {
        errorMessage = 'Você precisa estar autenticado.';
        setStatus('unauthenticated');
        return;
      }

      setStatus('error');
      setMessage(errorMessage);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;

    const inviteCode = searchParams.get('code');

    if (!inviteCode) {
      setStatus('error');
      setMessage('Código de convite inválido ou ausente.');
      return;
    }

    if (!user) {
      setStatus('unauthenticated');
      setMessage('Você precisa estar autenticado para aceitar convites.');
      return;
    }

    acceptInvite(inviteCode);
  }, [user, authLoading, searchParams, acceptInvite]);

  const handleLogin = () => {
    // Save current URL to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    router.push('/login');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-foreground">{message || 'Carregando...'}</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
            <Share2 className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Autenticação Necessária</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-medium flex items-center justify-center gap-2"
          >
            Fazer Login
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Convite Aceito!</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-4">
              Redirecionando para o dashboard...
            </p>
            <button
              onClick={handleGoToDashboard}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-medium flex items-center justify-center gap-2"
            >
              Ir para o Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Erro ao Aceitar Convite</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>
          <button
            onClick={handleGoToDashboard}
            className="w-full px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-all duration-200 font-medium"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
