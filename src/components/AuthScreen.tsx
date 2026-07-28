import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import {
  auth,
  googleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from '../lib/firebase';

interface AuthScreenProps {
  onLogin: (session: UserSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [activeNodesCount, setActiveNodesCount] = useState(1201.6);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Random node jitter for live network telemetry feel
  useEffect(() => {
    const interval = setInterval(() => {
      const base = 1200;
      const jitter = Math.floor(Math.random() * 50);
      setActiveNodesCount(parseFloat((base + jitter / 10).toFixed(1)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('PLEASE_ENTER_EMAIL_AND_PASSWORD');
      return;
    }

    setLoading(true);

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      const firebaseUser = userCredential.user;
      onLogin({
        id: firebaseUser.uid,
        email: firebaseUser.email || email,
        identifier: firebaseUser.email || email,
        authenticated: true,
        nodeType: 'EPH_NODE_0.4.2',
        encryptionAlgorithm: 'AES-256-GCM',
      });
    } catch (err: any) {
      console.error('Firebase Auth Error:', err);
      let msg = err.message || 'AUTHENTICATION_FAILED';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'INVALID_EMAIL_OR_ACCESS_KEY';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'USER_NOT_FOUND._PLEASE_SIGN_UP';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'EMAIL_ALREADY_REGISTERED._PLEASE_SIGN_IN';
      } else if (err.code === 'auth/weak-password') {
        msg = 'ACCESS_KEY_MUST_BE_AT_LEAST_6_CHARACTERS';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'INVALID_EMAIL_FORMAT';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const userCredential = await signInWithPopup(auth, googleAuthProvider);
      const firebaseUser = userCredential.user;
      onLogin({
        id: firebaseUser.uid,
        email: firebaseUser.email || 'user@gmail.com',
        identifier: firebaseUser.email || firebaseUser.uid,
        authenticated: true,
        nodeType: 'EPH_NODE_0.4.2',
        encryptionAlgorithm: 'AES-256-GCM',
      });
    } catch (err: any) {
      console.error('Firebase Google Auth Error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err.message || 'GOOGLE_SIGNIN_FAILED');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mesh-bg min-h-screen flex items-center justify-center p-6 pt-24 pb-12 selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Mesh Gradient Background Glowing Orbs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[150px] pointer-events-none"></div>

      <main className="relative z-10 w-full max-w-[460px]">
        {/* Branding Anchor */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3.5 h-3.5 bg-blue-500 rounded-full shadow-[0_0_15px_#3b82f6] animate-pulse"></div>
            <span className="font-mono text-xs font-bold text-blue-400 uppercase tracking-[0.25em]">
              FLUX_P2P.FIREBASE_AUTH
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-geist font-bold text-white tracking-tighter mb-2">
            ACTIVE_NODES:
            <br />
            <span className="text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              {activeNodesCount}K
            </span>
          </h1>

          <div className="px-3 py-1 border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-full mt-2">
            <span className="font-mono text-[11px] font-bold text-white/60 uppercase tracking-widest">
              EPH_NODE_0.4.2 // FIREBASE_ENCRYPTED
            </span>
          </div>
        </div>

        {/* Login Card: Frosted Glass */}
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col space-y-6 shadow-2xl">
          <header className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-geist font-bold text-white">
                {isSignUp ? 'Create Node Account' : 'Establish Connection'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {isSignUp ? 'REGISTER' : 'LOGIN'}
              </span>
            </div>
            <p className="text-sm font-sans text-white/60">
              {isSignUp
                ? 'Register your peer identity to access the grid.'
                : 'Sign in with your email or Google account to open dashboard.'}
            </p>
          </header>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-400 font-mono text-xs">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span className="break-all">{errorMsg}</span>
            </div>
          )}

          {/* Social Auth Option */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleGoogleLogin}
              type="button"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center space-x-3 bg-white/5 border border-white/20 hover:bg-white/10 hover:border-blue-400/50 rounded-xl transition-all group cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="font-mono text-xs font-bold tracking-widest text-white">
                CONTINUE_WITH_GOOGLE
              </span>
            </button>
            <div className="flex items-center py-1">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="px-4 font-mono text-xs text-white/40">OR EMAIL</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>
          </div>

          {/* Email Auth Form */}
          <form className="flex flex-col space-y-4" onSubmit={handleEmailAuth}>
            <div className="flex flex-col space-y-1.5">
              <label className="font-mono text-[11px] font-bold text-white/60 uppercase tracking-widest">
                EMAIL_ADDRESS
              </label>
              <input
                className="input-underlined w-full px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/20"
                placeholder="you@domain.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="font-mono text-[11px] font-bold text-white/60 uppercase tracking-widest">
                ACCESS_KEY (PASSWORD)
              </label>
              <div className="relative">
                <input
                  className="input-underlined w-full px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/20"
                  placeholder="••••••••"
                  type={showKey ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 cursor-pointer"
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="frosted-button-primary w-full py-4 rounded-xl font-mono text-xs tracking-widest font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    {isSignUp ? 'CREATING_ACCOUNT...' : 'VERIFYING_NODE...'}
                  </>
                ) : isSignUp ? (
                  'CREATE_ACCOUNT'
                ) : (
                  'INITIATE_SESSION'
                )}
              </button>
            </div>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <footer className="flex justify-between items-center pt-3 border-t border-white/10">
            <span className="font-mono text-xs text-white/50">
              {isSignUp ? 'Already have a node?' : 'New peer node?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="font-mono text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer underline underline-offset-4"
            >
              {isSignUp ? 'SIGN_IN' : 'CREATE_ACCOUNT'}
            </button>
          </footer>
        </section>

        {/* Technical Metadata Display */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="border border-white/10 p-4 bg-white/[0.03] backdrop-blur-md rounded-2xl">
            <div className="font-mono text-[11px] font-bold text-white/50 mb-1">AUTH_PROVIDER</div>
            <div className="font-mono text-xs font-bold text-blue-400">FIREBASE_AUTH</div>
          </div>
          <div className="border border-white/10 p-4 bg-white/[0.03] backdrop-blur-md rounded-2xl">
            <div className="font-mono text-[11px] font-bold text-white/50 mb-1">NETWORK_STATUS</div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 animate-pulse rounded-full"></div>
              <div className="font-mono text-xs font-bold text-blue-400 uppercase">
                ACTIVE: {activeNodesCount}K
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
