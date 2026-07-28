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
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
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
    const code = otpValues.join('').replace(/-/g, '').trim();
    if (code.length === 6) {
      onJoinRoom(code);
    } else {
      alert('Please enter the full 6-character room code.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col pt-24 pb-20 px-4 md:px-12 selection:bg-[#7342E2] selection:text-white relative overflow-hidden bg-[#F2F2EE]">
      {/* Background ambient video loop or subtle gradient */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 z-0 w-full h-full object-cover opacity-15"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_131516_eca35265-ea66-4fbd-8d52-22aae6e1a503.mp4"
          type="video/mp4"
        />
      </video>

      {/* Main Content Grid */}
      <main className="flex-grow flex items-center justify-center py-6 relative z-10">
        <div className="w-full max-w-[1280px] grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Left Panel: CREATE_ROOM */}
          <div className="bg-white/80 backdrop-blur-2xl border border-[#192837]/10 rounded-3xl p-8 md:p-12 flex flex-col justify-between min-h-[420px] transition-all duration-300 hover:border-[#7342E2]/50 hover:shadow-xl group shadow-md">
            <div>
              <span className="font-mono text-xs font-bold text-[#7342E2] mb-4 block tracking-widest uppercase">
                // UPLINK_01 : DIRECT_TUNNEL
              </span>
              <h1 className="text-3xl md:text-5xl font-heading font-bold text-[#192837] mb-6">
                CREATE_ROOM
              </h1>
              <p className="font-sans text-base text-[#192837]/80 max-w-sm mb-8 leading-relaxed">
                Initialize a new ephemeral encrypted WebRTC room. Peers connect using a unique hash token with zero server storage.
              </p>
              <div className="border border-[#192837]/10 rounded-2xl p-4 inline-block mb-8 bg-white/70 backdrop-blur-md shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7342E2] shadow-[0_0_10px_#7342E2] animate-pulse"></span>
                  <span className="font-mono text-xs font-bold text-[#192837]">ENCRYPTION: AES-256-GCM (WebCrypto)</span>
                </div>
              </div>
            </div>
            <button
              onClick={onCreateRoom}
              className="font-mono text-xs font-bold py-4 px-8 rounded-full w-full md:w-auto tracking-widest hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-white bg-[#7342E2] hover:bg-[#7342E2]/90 shadow-md transition-all"
            >
              <span className="material-symbols-outlined text-lg">add_link</span>
              INITIALIZE_TUNNEL
            </button>
          </div>

          {/* Right Panel: JOIN_ROOM */}
          <div className="bg-white/80 backdrop-blur-2xl border border-[#192837]/10 rounded-3xl p-8 md:p-12 flex flex-col justify-between min-h-[420px] transition-all duration-300 hover:border-[#7342E2]/50 hover:shadow-xl group shadow-md">
            <div>
              <span className="font-mono text-xs font-bold text-[#7342E2] mb-4 block tracking-widest uppercase">
                // DOWNLINK_02 : PEER_CONNECT
              </span>
              <h2 className="text-3xl md:text-5xl font-heading font-bold text-[#192837] mb-6">
                JOIN_ROOM
              </h2>
              <p className="font-sans text-base text-[#192837]/80 max-w-sm mb-8 leading-relaxed">
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
                    className="w-11 h-16 sm:w-12 sm:h-16 bg-white border border-[#192837]/20 rounded-2xl text-center font-mono text-xl text-[#7342E2] focus:border-[#7342E2] focus:bg-[#7342E2]/10 focus:shadow-[0_0_15px_rgba(115,66,226,0.2)] transition-all focus:outline-none font-bold"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleVerifyJoin}
              className="bg-white border border-[#192837]/20 text-[#192837] hover:bg-[#F2F2EE] hover:border-[#7342E2]/50 rounded-full font-mono text-xs font-bold py-4 px-8 w-full md:w-auto tracking-widest transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">vpn_key</span>
              VERIFY_CONNECTION
            </button>
          </div>
        </div>
      </main>

      {/* Side Decoration (Stats Sidebar on Desktop) */}
      <aside className="fixed right-0 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-8 px-8 border-l border-[#192837]/10 z-20">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-bold text-[#192837]/50 uppercase">ACTIVE_NODES</span>
          <span className="font-heading text-2xl font-bold text-[#192837]">1,242</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-bold text-[#192837]/50 uppercase">THROUGHPUT</span>
          <span className="font-heading text-2xl font-bold text-[#7342E2]">4.2 GB/s</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-bold text-[#192837]/50 uppercase">AVG_LATENCY</span>
          <span className="font-heading text-2xl font-bold text-emerald-600">12ms</span>
        </div>
      </aside>

      {/* Floating Action Button (FAB) on Desktop */}
      <button
        onClick={onCreateRoom}
        title="Quick Create Room"
        className="fixed bottom-12 right-12 w-14 h-14 bg-[#7342E2] hover:bg-[#7342E2]/90 text-white rounded-full flex items-center justify-center z-40 transition-transform active:scale-90 shadow-lg hidden md:flex cursor-pointer"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Bottom Navigation Bar (Mobile only) */}
      <footer className="md:hidden bg-white/90 backdrop-blur-xl fixed bottom-0 left-0 w-full flex justify-around items-center h-16 z-50 border-t border-[#192837]/10">
        <button
          onClick={() => setView('DASHBOARD')}
          className="flex flex-col items-center justify-center text-[#7342E2] px-4 py-1"
        >
          <span className="material-symbols-outlined text-xl">grid_view</span>
          <span className="font-mono text-[10px] font-bold">DASHBOARD</span>
        </button>
        <button
          onClick={() => setView('ROOM')}
          className="flex flex-col items-center justify-center text-[#192837]/60 px-4 py-1 hover:text-[#192837]"
        >
          <span className="material-symbols-outlined text-xl">swap_horiz</span>
          <span className="font-mono text-[10px] font-bold">ROOM</span>
        </button>
        <button
          onClick={() => setView('NETWORK')}
          className="flex flex-col items-center justify-center text-[#192837]/60 px-4 py-1 hover:text-[#192837]"
        >
          <span className="material-symbols-outlined text-xl">hub</span>
          <span className="font-mono text-[10px] font-bold">NETWORK</span>
        </button>
        <button
          onClick={() => setView('HISTORY')}
          className="flex flex-col items-center justify-center text-[#192837]/60 px-4 py-1 hover:text-[#192837]"
        >
          <span className="material-symbols-outlined text-xl">history</span>
          <span className="font-mono text-[10px] font-bold">HISTORY</span>
        </button>
      </footer>
    </div>
  );
};
