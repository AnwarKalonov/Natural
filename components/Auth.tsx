import React, { useEffect, useMemo, useState } from 'react';
import { primeOAuthPkce, type UserRecord } from '../services/platformService';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset';

interface AuthProps {
  initialView: 'login' | 'signup';
  onComplete: (user: UserRecord) => void;
  onBack: () => void;
  onLogin: (input: { email: string; password: string }) => Promise<UserRecord> | UserRecord;
  onSignup: (input: { name: string; email: string; password: string }) => Promise<UserRecord> | UserRecord;
  onRequestPasswordReset: (email: string) => Promise<string> | string;
  onResetPassword: (token: string, newPassword: string) => Promise<void> | void;
  onOAuthLogin: (provider: 'google' | 'github') => Promise<void> | void;
}

export const Auth: React.FC<AuthProps> = ({
  initialView,
  onComplete,
  onBack,
  onLogin,
  onSignup,
  onRequestPasswordReset,
  onResetPassword,
  onOAuthLogin
}) => {
  const [view, setView] = useState<AuthView>(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const isSignup = view === 'signup';

  useEffect(() => {
    if (view === 'login' || view === 'signup') {
      primeOAuthPkce();
    }
  }, [view]);

  const submitLabel = useMemo(() => {
    if (view === 'login') return 'Continue with Email';
    if (view === 'signup') return 'Create Account';
    if (view === 'forgot') return 'Send Reset Token';
    return 'Reset Password';
  }, [view]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      if (view === 'login') {
        const user = await onLogin({ email, password });
        onComplete(user);
      } else if (view === 'signup') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const user = await onSignup({ name, email, password });
        onComplete(user);
      } else if (view === 'forgot') {
        const result = await onRequestPasswordReset(email);
        setSuccess(result);
        setView('login');
      } else {
        if (resetPasswordValue.length < 6) throw new Error('New password must be at least 6 characters.');
        await onResetPassword(resetToken, resetPasswordValue);
        setSuccess('Password reset complete. You can login now.');
        setView('login');
        setPassword('');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex overflow-hidden animate-in fade-in duration-500">
      <style>{`
        @keyframes kenburns {
            0% { transform: scale(1.1) translate(0, 0); }
            50% { transform: scale(1.2) translate(-2%, -2%); }
            100% { transform: scale(1.1) translate(0, 0); }
        }
        .animate-kenburns {
            animation: kenburns 30s ease-in-out infinite;
        }
        @keyframes authFadeUp {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .auth-fade-up {
            animation: authFadeUp 420ms cubic-bezier(.2,.8,.2,1);
        }
      `}</style>

      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 md:px-24 relative z-20 bg-[#020202] border-r border-white/5">
        <button
          onClick={onBack}
          className="absolute top-8 left-8 flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Home
        </button>

        <div key={view} className="max-w-md w-full mx-auto auth-fade-up">
          <div className="mb-10 transition-all duration-300">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
              {view === 'login' && 'Welcome back'}
              {view === 'signup' && 'Create an account'}
              {view === 'forgot' && 'Reset password'}
              {view === 'reset' && 'Set new password'}
            </h1>
            <p className="text-white/40 text-sm">
              {view === 'login' && 'Enter your details to access your workspace.'}
              {view === 'signup' && 'Start building your app with your own workspace.'}
              {view === 'forgot' && 'Generate a reset token for your account email.'}
              {view === 'reset' && 'Use your token and set a new password.'}
            </p>
          </div>

          {(view === 'login' || view === 'signup') && (
            <div className="space-y-4 mb-8 transition-all duration-300">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  clearMessages();
                  setLoading(true);
                  void Promise.resolve(onOAuthLogin('google')).catch((err: any) => {
                    setLoading(false);
                    setError(err?.message || 'Google login failed.');
                  });
                }}
                className="w-full bg-white text-black h-12 rounded-lg font-medium hover:bg-gray-100 transition-all duration-200 flex items-center justify-center gap-3 text-sm hover:scale-[1.01] active:scale-[0.995]"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                Continue with Google
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  clearMessages();
                  setLoading(true);
                  void Promise.resolve(onOAuthLogin('github')).catch((err: any) => {
                    setLoading(false);
                    setError(err?.message || 'GitHub login failed.');
                  });
                }}
                className="w-full bg-[#1c1e21] text-white border border-[#2b3035] h-12 rounded-lg font-medium hover:bg-[#25282c] transition-all duration-200 flex items-center justify-center gap-3 text-sm hover:scale-[1.01] active:scale-[0.995]"
              >
                Continue with GitHub
              </button>
            </div>
          )}

          {(view === 'login' || view === 'signup') && (
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#020202] px-2 text-white/30 tracking-wider font-medium">Or continue with email</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 transition-all duration-300">
            {isSignup && (
              <input
                type="text"
                className="w-full h-11 bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                placeholder="Full Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            )}

            {(view === 'login' || view === 'signup' || view === 'forgot') && (
              <input
                type="email"
                className="w-full h-11 bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            )}

            {(view === 'login' || view === 'signup') && (
              <input
                type="password"
                className="w-full h-11 bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            )}

            {view === 'signup' && (
              <input
                type="password"
                className="w-full h-11 bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            )}

            {view === 'reset' && (
              <>
                <input
                  type="text"
                  className="w-full h-11 bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                  placeholder="Reset Token"
                  value={resetToken}
                  onChange={e => setResetToken(e.target.value)}
                  required
                />
                <input
                  type="password"
                  className="w-full h-11 bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                  placeholder="New Password"
                  value={resetPasswordValue}
                  onChange={e => setResetPasswordValue(e.target.value)}
                  required
                />
              </>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}
            {success && <p className="text-green-400 text-xs">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#1c1e21] text-white font-medium rounded-lg hover:bg-[#25282c] border border-white/5 transition-all duration-200 hover:scale-[1.01] active:scale-[0.995]"
            >
              {loading ? 'Processing...' : submitLabel}
            </button>
          </form>

          <div className="mt-8 text-center text-sm space-y-2">
            {(view === 'login' || view === 'signup') && (
              <>
                <div>
                  <span className="text-white/40">{view === 'login' ? "Don't have an account? " : 'Already have an account? '}</span>
                  <button
                    onClick={() => {
                      clearMessages();
                      setView(view === 'login' ? 'signup' : 'login');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {view === 'login' ? 'Sign up' : 'Log in'}
                  </button>
                </div>
                {view === 'login' && (
                  <button
                    onClick={() => {
                      clearMessages();
                      setView('forgot');
                    }}
                    className="text-xs text-white/50 hover:text-white"
                  >
                    Forgot password?
                  </button>
                )}
              </>
            )}

            {(view === 'forgot' || view === 'reset') && (
              <button
                onClick={() => {
                  clearMessages();
                  setView('login');
                }}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Back to login
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-[55%] relative overflow-hidden bg-[#0A0A0A]">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover animate-kenburns"
            src="https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=2551&auto=format&fit=crop"
            alt="Background"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#020202]/80"></div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] perspective-1000 z-20">
          <div className="relative bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-700 ease-out group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl pointer-events-none"></div>

            <div className="flex items-center gap-2 mb-6 opacity-50">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>

            <div className="space-y-4">
              <div className="h-4 w-2/3 bg-white/10 rounded animate-pulse"></div>
              <div className="h-4 w-1/2 bg-white/10 rounded animate-pulse delay-75"></div>

              <div className="mt-8 p-4 bg-[#050505]/50 rounded-xl border border-white/5 font-mono text-xs text-white/60 leading-relaxed">
                <span className="text-purple-400">const</span> <span className="text-blue-400">App</span> = () =&gt; {'{'} <br />
                &nbsp;&nbsp;<span className="text-purple-400">return</span> (<br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-green-400">&lt;Card&gt;</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-green-400">&lt;h1&gt;</span>Hello World<span className="text-green-400">&lt;/h1&gt;</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-green-400">&lt;/Card&gt;</span><br />
                &nbsp;&nbsp;);<br />
                {'}'}
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 animate-bounce">
                  <span className="material-symbols-outlined text-white text-sm">arrow_upward</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
