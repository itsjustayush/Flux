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
    <header className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-[#192837]/10 shadow-sm transition-all">
      <div className="flex justify-between items-center w-full px-6 md:px-12 py-3.5 max-w-[1280px] mx-auto">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setView(session?.authenticated ? 'DASHBOARD' : 'AUTH')}
            className="text-xl font-bold font-heading text-[#192837] tracking-tighter hover:opacity-90 transition-opacity flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-3 h-3 bg-[#7342E2] rounded-full shadow-[0_0_12px_#7342E2] animate-pulse"></div>
            FLUX<span className="text-[#7342E2]">.P2P</span>
          </button>

          {session?.authenticated && (
            <nav className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setView('DASHBOARD')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg cursor-pointer ${
                  currentView === 'DASHBOARD'
                    ? 'text-[#7342E2] bg-[#7342E2]/10 border border-[#7342E2]/30'
                    : 'text-[#192837]/70 hover:text-[#192837] hover:bg-[#192837]/5'
                }`}
              >
                DASHBOARD
              </button>
              <button
                onClick={() => setView('ROOM')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg cursor-pointer ${
                  currentView === 'ROOM'
                    ? 'text-[#7342E2] bg-[#7342E2]/10 border border-[#7342E2]/30'
                    : 'text-[#192837]/70 hover:text-[#192837] hover:bg-[#192837]/5'
                }`}
              >
                ROOM_VIEW
              </button>
              <button
                onClick={() => setView('NETWORK')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg cursor-pointer ${
                  currentView === 'NETWORK'
                    ? 'text-[#7342E2] bg-[#7342E2]/10 border border-[#7342E2]/30'
                    : 'text-[#192837]/70 hover:text-[#192837] hover:bg-[#192837]/5'
                }`}
              >
                NETWORK
              </button>
              <button
                onClick={() => setView('HISTORY')}
                className={`font-mono text-xs font-bold uppercase transition-all px-3 py-1.5 rounded-lg cursor-pointer ${
                  currentView === 'HISTORY'
                    ? 'text-[#7342E2] bg-[#7342E2]/10 border border-[#7342E2]/30'
                    : 'text-[#192837]/70 hover:text-[#192837] hover:bg-[#192837]/5'
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
                <span className="font-mono text-xs font-bold text-[#7342E2]">
                  NODE: {session.identifier.split('@')[0].toUpperCase()}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Disconnect Node Session"
                className="p-2 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-[#192837] border border-[#192837]/20 rounded-xl flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setView('AUTH')}
              className="font-mono text-xs font-bold text-white bg-[#7342E2] hover:bg-[#7342E2]/90 shadow-[0_0_15px_rgba(115,66,226,0.3)] px-5 py-2.5 rounded-full transition-all cursor-pointer"
            >
              ESTABLISH_CONNECTION
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

