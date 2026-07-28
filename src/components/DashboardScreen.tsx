import React, { useState, useRef } from 'react';
import { ViewMode, UserSession } from '../types';

interface DashboardScreenProps {
  session: UserSession;
  onCreateRoom: () => void;
  onJoinRoom: (otpCode: string) => void;
  setView: (view: ViewMode) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  session,
  onCreateRoom,
  onJoinRoom,
  setView,
}) => {
  const [otpValues, setOtpValues] = useState<string[]>(['4', '9', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (index: number, value: string) => {
    const val = value.toUpperCase();
    if (val.length > 1) {
      // If user pasted code e.g. "XR92K8"
      const pasted = val.slice(0, 6).split('');
      const newOtp = [...otpValues];
      pasted.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtpValues(newOtp);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otpValues];
    newOtp[index] = val;
    setOtpValues(newOtp);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyJoin = () => {
    const code = otpValues.join('');
    if (code.length >= 4) {
      onJoinRoom(code);
    } else {
      alert('Please enter a valid 6-digit room authentication code.');
    }
  };

  return (
    <div className="mesh-bg min-h-screen flex flex-col pt-24 pb-20 px-4 md:px-12 selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Background ambient orbs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Main Content Grid */}
      <main className="flex-grow flex items-center justify-center py-6 relative z-10">
        <div className="w-full max-w-[1200px] grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Left Panel: CREATE_ROOM */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-8 md:p-12 flex flex-col justify-between min-h-[420px] transition-all duration-300 hover:border-blue-500/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] group">
            <div>
              <span className="font-mono text-xs font-bold text-blue-400 mb-4 block tracking-widest uppercase">
                // UPLINK_01 : DIRECT_TUNNEL
              </span>
              <h1 className="text-3xl md:text-5xl font-geist font-bold text-white mb-6">
                CREATE_ROOM
              </h1>
              <p className="font-sans text-base text-white/70 max-w-sm mb-8 leading-relaxed">
                Initialize a new ephemeral encrypted WebRTC room. Peers connect using a unique hash token with zero server storage.
              </p>
              <div className="border border-white/10 rounded-xl p-4 inline-block mb-8 bg-black/40 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-pulse"></span>
                  <span className="font-mono text-xs text-white">ENCRYPTION: AES-256-GCM (WebCrypto)</span>
                </div>
              </div>
            </div>
            <button
              onClick={onCreateRoom}
              className="frosted-button-primary font-mono text-xs font-bold py-4 px-8 rounded-xl w-full md:w-auto tracking-widest hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add_link</span>
              INITIALIZE_TUNNEL
            </button>
          </div>

          {/* Right Panel: JOIN_ROOM */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-8 md:p-12 flex flex-col justify-between min-h-[420px] transition-all duration-300 hover:border-blue-500/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] group">
            <div>
              <span className="font-mono text-xs font-bold text-blue-400 mb-4 block tracking-widest uppercase">
                // DOWNLINK_02 : PEER_CONNECT
              </span>
              <h2 className="text-3xl md:text-5xl font-geist font-bold text-white mb-6">
                JOIN_ROOM
              </h2>
              <p className="font-sans text-base text-white/70 max-w-sm mb-8 leading-relaxed">
                Enter the 6-character room authentication token provided by the host to bridge the peer-to-peer data channel.
              </p>

              {/* OTP Input Group */}
              <div className="flex gap-2.5 sm:gap-3 mb-8 w-full justify-between sm:justify-start">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    placeholder="•"
                    className="otp-input w-11 h-16 sm:w-12 sm:h-16 bg-white/5 border border-white/20 rounded-xl text-center font-mono text-xl text-blue-400 focus:border-blue-500 focus:bg-blue-500/10 focus:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all focus:outline-none font-bold"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleVerifyJoin}
              className="bg-white/5 border border-white/20 text-white hover:bg-white/10 hover:border-blue-400/50 rounded-xl font-mono text-xs font-bold py-4 px-8 w-full md:w-auto tracking-widest transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">vpn_key</span>
              VERIFY_CONNECTION
            </button>
          </div>
        </div>
      </main>

      {/* Side Decoration (Stats Sidebar on Desktop) */}
      <aside className="fixed right-0 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-8 px-8 border-l border-white/10 z-20">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-bold text-white/50 uppercase">ACTIVE_NODES</span>
          <span className="font-geist text-2xl font-bold text-white">1,242</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-bold text-white/50 uppercase">THROUGHPUT</span>
          <span className="font-geist text-2xl font-bold text-blue-400">4.2 GB/s</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-bold text-white/50 uppercase">AVG_LATENCY</span>
          <span className="font-geist text-2xl font-bold text-emerald-400">12ms</span>
        </div>
      </aside>

      {/* Floating Action Button (FAB) on Desktop */}
      <button
        onClick={onCreateRoom}
        title="Quick Create Room"
        className="fixed bottom-12 right-12 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center z-40 transition-transform active:scale-90 shadow-[0_0_25px_rgba(59,130,246,0.6)] hidden md:flex cursor-pointer"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Bottom Navigation Bar (Mobile only) */}
      <footer className="md:hidden bg-black/60 backdrop-blur-xl fixed bottom-0 left-0 w-full flex justify-around items-center h-16 z-50 border-t border-white/10">
        <button
          onClick={() => setView('DASHBOARD')}
          className="flex flex-col items-center justify-center text-blue-400 px-4 py-1"
        >
          <span className="material-symbols-outlined text-xl">grid_view</span>
          <span className="font-mono text-[10px] font-bold">DASHBOARD</span>
        </button>
        <button
          onClick={() => setView('ROOM')}
          className="flex flex-col items-center justify-center text-white/60 px-4 py-1 hover:text-white"
        >
          <span className="material-symbols-outlined text-xl">swap_horiz</span>
          <span className="font-mono text-[10px] font-bold">PACKAGE</span>
        </button>
        <button
          onClick={() => setView('ROOM')}
          className="flex flex-col items-center justify-center text-white/60 px-4 py-1 hover:text-white"
        >
          <span className="material-symbols-outlined text-xl">layers</span>
          <span className="font-mono text-[10px] font-bold">BUNDLE</span>
        </button>
      </footer>
    </div>
  );
};
