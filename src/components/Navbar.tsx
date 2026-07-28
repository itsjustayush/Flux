import React from 'react';
import { ViewMode, UserSession } from '../types';

interface NavbarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  session: UserSession | null;
  onLogout: () => void;
  latencyMs: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setView,
  session,
  onLogout,
  latencyMs,
}) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
      <div className="flex justify-between items-center w-full px-6 md:px-12 py-3.5 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setView(session?.authenticated ? 'DASHBOARD' : 'AUTH')}
            className="text-xl font-bold font-geist text-white tracking-tighter hover:opacity-90 transition-opacity flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_12px_#3b82f6] animate-pulse"></div>
            FLUX<span className="text-blue-400">.P2P</span>
          </button>

          {session?.authenticated && (
            <nav className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setView('DASHBOARD')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg ${
                  currentView === 'DASHBOARD'
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                DASHBOARD
              </button>
              <button
                onClick={() => setView('ROOM')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg ${
                  currentView === 'ROOM'
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                ROOM_VIEW
              </button>
              <button
                onClick={() => setView('NETWORK')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg ${
                  currentView === 'NETWORK'
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                NETWORK
              </button>
              <button
                onClick={() => setView('HISTORY')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg ${
                  currentView === 'HISTORY'
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                HISTORY
              </button>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {session?.authenticated ? (
            <>
              <div className="hidden sm:flex flex-col items-end">
                <span className="font-mono text-xs text-blue-400">
                  NODE: {session.identifier.split('@')[0].toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-white/50 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  EPH_TUNNEL // {latencyMs}ms
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Disconnect Node Session"
                className="p-2 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-white border border-white/20 rounded-xl flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">account_circle</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setView('AUTH')}
              className="font-mono text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              ESTABLISH_CONNECTION
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
