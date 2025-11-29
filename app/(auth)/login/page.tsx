'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight, Ticket } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, user, loading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Erro ao fazer login');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (!displayName.trim()) {
      setError('Por favor, insira um nome de usuário');
      return;
    }

    if (!inviteCode.trim()) {
      setError('Por favor, insira um código de convite válido');
      return;
    }

    setSubmitting(true);

    try {
      await signUp(email, password, displayName, inviteCode.trim());
      router.push('/dashboard');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Erro ao criar conta');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-accent p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 opacity-10">
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.15) 1px, transparent 0)',
              backgroundSize: '40px 40px'
            }} 
          />
        </div>
        
        {/* Logo & Description */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-md" />
            </div>
            <h1 className="font-display text-3xl font-bold text-white">
              Haumea
            </h1>
          </div>
          
          <div className="max-w-md">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 leading-tight">
              Plataforma de Chat IA Avançado
            </h2>
            <p className="text-white/90 text-lg leading-relaxed">
              Converse com múltiplos modelos de IA, gerencie suas conversas e maximize sua produtividade.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-4 text-white/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Múltiplos provedores de IA em um só lugar</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Organização avançada com pastas e tags</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Segurança e privacidade garantidas</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <div className="w-5 h-5 bg-primary rounded-md" />
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Haumea
              </h1>
            </div>
          </div>

          {/* Card */}
          <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            {/* Gradient Header */}
            <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-8 border-b border-border/50">
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/5 to-transparent" />
              
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
              
              <div className="relative flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="relative w-7 h-7">
                    <Lock 
                      className={cn(
                        "absolute inset-0 w-7 h-7 text-white transition-all duration-300",
                        activeTab === 'login' ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 -rotate-90"
                      )}
                    />
                    <User 
                      className={cn(
                        "absolute inset-0 w-7 h-7 text-white transition-all duration-300",
                        activeTab === 'register' ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 rotate-90"
                      )}
                    />
                  </div>
                </div>
                
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-display font-bold text-foreground mb-2 transition-all duration-300">
                    {activeTab === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'}
                  </h2>
                  <p className="text-muted-foreground transition-all duration-300">
                    {activeTab === 'login' 
                      ? 'Bem-vindo de volta! Faça login para continuar.'
                      : 'Junte-se a nós e comece a usar o Haumea hoje.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-8">

            {/* Tabs */}
            <div className="flex gap-1 mb-8 p-1 bg-muted/50 rounded-lg relative">
              <button
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                }}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-md font-medium transition-all text-sm relative z-10",
                  activeTab === 'login'
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setActiveTab('register');
                  setError('');
                }}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-md font-medium transition-all text-sm relative z-10",
                  activeTab === 'register'
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Registro
              </button>
              {/* Animated Background */}
              <div 
                className={cn(
                  "absolute top-1 bottom-1 bg-background rounded-md shadow-sm transition-all duration-300 ease-out",
                  activeTab === 'login' ? "left-1 right-[50%]" : "left-[50%] right-1"
                )}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <svg className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Login Form */}
            {activeTab === 'login' && (
              <form 
                onSubmit={handleLogin} 
                className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300"
                key="login-form"
              >
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium mb-1.5 text-foreground">
                    Email ou Nome de usuário
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="login-email"
                      type="text"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
                      placeholder="Informe seu email ou usuário"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium mb-1.5 text-foreground">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-12 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer" />
                    <span className="text-sm text-muted-foreground select-none">Lembrar de mim</span>
                  </label>
                  <Link
                    href="/reset-password"
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary flex items-center justify-center gap-2 mt-6"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form 
                onSubmit={handleRegister} 
                className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300"
                key="register-form"
              >
                <div>
                  <label htmlFor="register-name" className="block text-sm font-medium mb-1.5 text-foreground">
                    Nome de usuário
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="register-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
                      placeholder="Rafael Becker Lenz"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="register-email" className="block text-sm font-medium mb-1.5 text-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="register-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="register-password" className="block text-sm font-medium mb-1.5 text-foreground">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-12 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="register-confirm-password" className="block text-sm font-medium mb-1.5 text-foreground">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="register-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
                      placeholder="Confirme sua senha"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="register-invite-code" className="block text-sm font-medium mb-1.5 text-foreground">
                    Código de convite
                  </label>
                  <div className="relative">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="register-invite-code"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      required
                      disabled={submitting}
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground uppercase"
                      placeholder="Ex: ABC123XYZ"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    O registro é restrito. Você precisa de um código de convite para criar uma conta.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary flex items-center justify-center gap-2 mt-6"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      Criar conta
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-xs text-center text-muted-foreground pt-2">
                  Ao criar uma conta, você concorda com nossos{' '}
                  <a href="#" className="text-primary hover:underline font-medium">
                    Termos de Uso
                  </a>
                </p>
              </form>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
