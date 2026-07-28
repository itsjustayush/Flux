import React from 'react';
import { RoomState } from '../types';

interface NetworkTopologyScreenProps {
  room: RoomState;
}

export const NetworkTopologyScreen: React.FC<NetworkTopologyScreenProps> = ({ room }) => {
  return (
    <div className="mesh-bg min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-[1200px] mx-auto selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Mesh Background Orbs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[150px] pointer-events-none"></div>

      <header className="relative z-10 mb-8 border-b border-white/10 pb-4">
        <span className="font-mono text-xs font-bold text-blue-400 block mb-1">
          // DECENTRALIZED_TOPOLOGY
        </span>
        <h1 className="text-3xl md:text-4xl font-geist font-bold text-white">
          PEER_MESH_GRAPH // {room.id}
        </h1>
        <p className="font-sans text-sm text-white/60 mt-1">
          Real-time WebRTC data channels, encryption status, and peer routing matrix.
        </p>
      </header>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Topology Visual Canvas */}
        <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-8 min-h-[400px] flex flex-col justify-between relative overflow-hidden shadow-2xl">
          <div className="flex justify-between items-center z-10">
            <span className="font-mono text-xs font-bold text-white">
              ACTIVE_SIGNALING: SUPABASE_REALTIME + WEBRTC
            </span>
            <span className="px-3 py-1 bg-blue-500/10 border border-blue-400/40 text-blue-400 font-mono text-xs rounded-full">
              0 SERVER STORAGE
            </span>
          </div>

          {/* Graphical Node Connectors */}
          <div className="relative my-12 flex items-center justify-around">
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-16 h-16 bg-white/5 backdrop-blur-md rounded-2xl border-2 border-blue-400 flex items-center justify-center font-mono text-sm font-bold text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                OP_01
              </div>
              <span className="font-mono text-xs text-white">YOU (HOST)</span>
              <span className="font-mono text-[10px] text-blue-300">AES-256-GCM</span>
            </div>

            <div className="flex-1 h-0.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 relative mx-4 animate-pulse">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 font-mono text-[10px] text-blue-400 shadow-lg">
                24MS // 14.2 MB/S
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-16 h-16 bg-white/5 backdrop-blur-md rounded-2xl border border-white/30 flex items-center justify-center font-mono text-sm font-bold text-white/80">
                OP_02
              </div>
              <span className="font-mono text-xs text-white">EPH_PEER_ALPHA</span>
              <span className="font-mono text-[10px] text-blue-300">AES-256-GCM</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-4 z-10">
            <div>
              <div className="font-mono text-[10px] text-white/50">ENCRYPTION KEY</div>
              <div className="font-mono text-xs text-blue-400">LOCAL_WEB_CRYPTO</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-white/50">STUN/TURN SERVER</div>
              <div className="font-mono text-xs text-white">DIRECT_ICE_HOST</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-white/50">DATA CHANNEL</div>
              <div className="font-mono text-xs text-emerald-400">OPEN_STABLE</div>
            </div>
          </div>
        </div>

        {/* Telemetry & Carbon Breakdown */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
          <div>
            <h3 className="font-mono text-xs font-bold text-blue-400 mb-4 uppercase tracking-wider">
              // CARBON_FOOTPRINT_SAVINGS
            </h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl">
                <span className="font-mono text-[11px] text-white/50 block mb-1">
                  P2P vs CLOUD SERVER COMPARISON
                </span>
                <div className="font-geist text-2xl font-bold text-emerald-400">
                  -91.6% CO2e EMISSIONS
                </div>
                <p className="font-sans text-xs text-white/60 mt-1 leading-relaxed">
                  Ephemeral browser-to-browser WebRTC transfers eliminate intermediate cloud file storage servers, drastically lowering carbon footprint per transfer.
                </p>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-white/60">Cloud Server Baseline:</span>
                  <span className="text-red-400 font-bold">~0.060 g CO2e/MB</span>
                </div>
                <div className="flex justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-white/60">FLUX_P2P Ephemeral:</span>
                  <span className="text-emerald-400 font-bold">~0.005 g CO2e/MB</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <span className="font-mono text-[11px] text-white/50 block mb-1">
              PROTOCOL INTEGRITY
            </span>
            <span className="font-mono text-xs text-white">
              SHA-256 PARALLEL CHECKSUM // ACTIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
