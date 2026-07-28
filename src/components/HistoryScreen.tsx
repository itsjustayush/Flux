import React from 'react';
import { BundleItem } from '../types';
import { formatBytes } from '../lib/crypto';

interface HistoryScreenProps {
  bundleItems: BundleItem[];
  onWipeSession: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ bundleItems, onWipeSession }) => {
  const totalBytes = bundleItems.reduce((acc, curr) => acc + curr.size, 0);
  const totalCarbonGrams = bundleItems.reduce((acc, curr) => acc + curr.carbonFootprintGrams, 0);
  const savedCloudCarbonGrams = parseFloat((totalBytes / (1024 * 1024) * 0.055).toFixed(2));

  return (
    <div className="mesh-bg min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-[1200px] mx-auto selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Mesh Background Orbs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[150px] pointer-events-none"></div>

      <header className="relative z-10 mb-8 border-b border-white/10 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-mono text-xs font-bold text-blue-400 block mb-1">
            // EPHEMERAL_SESSION_LOGS
          </span>
          <h1 className="text-3xl md:text-4xl font-geist font-bold text-white">
            TRANSFERRED_ASSETS_CACHE
          </h1>
        </div>

        <button
          onClick={onWipeSession}
          className="border border-red-500/50 text-red-400 hover:bg-red-500/10 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">delete_forever</span>
          WIPE_EPHEMERAL_RAM
        </button>
      </header>

      {/* Overview Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-xl">
          <span className="font-mono text-[11px] font-bold text-white/50 block mb-1">
            TOTAL_ASSETS_HELD
          </span>
          <span className="font-geist text-3xl font-bold text-white">
            {bundleItems.length} FILES
          </span>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-xl">
          <span className="font-mono text-[11px] font-bold text-white/50 block mb-1">
            TOTAL_EPHEMERAL_DATA
          </span>
          <span className="font-geist text-3xl font-bold text-blue-400">
            {formatBytes(totalBytes)}
          </span>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-xl">
          <span className="font-mono text-[11px] font-bold text-white/50 block mb-1">
            ESTIMATED_CARBON_SAVINGS
          </span>
          <span className="font-geist text-3xl font-bold text-emerald-400">
            {savedCloudCarbonGrams}g CO2e
          </span>
        </div>
      </div>

      {/* Asset Table */}
      <div className="relative z-10 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 bg-white/[0.02] border-b border-white/10 flex justify-between items-center">
          <span className="font-mono text-xs font-bold text-white">SESSION_PAYLOAD_REGISTRY</span>
          <span className="font-mono text-[11px] text-blue-400">NON-PERSISTENT (RAM ONLY)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-white/50">
              <tr>
                <th className="p-3.5">FILE_NAME</th>
                <th className="p-3.5">FILE_ID</th>
                <th className="p-3.5">SIZE</th>
                <th className="p-3.5">ENCRYPTION</th>
                <th className="p-3.5">CARBON</th>
                <th className="p-3.5">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white">
              {bundleItems.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3.5 font-bold truncate max-w-[200px]">{item.name}</td>
                  <td className="p-3.5 text-blue-400">{item.fileId}</td>
                  <td className="p-3.5">{formatBytes(item.size)}</td>
                  <td className="p-3.5 text-emerald-400">{item.encryptionStatus}</td>
                  <td className="p-3.5">{item.carbonFootprintGrams}g CO2e</td>
                  <td className="p-3.5">
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = item.blobUrl || '#';
                        a.download = item.name;
                        a.click();
                      }}
                      className="text-blue-400 hover:underline cursor-pointer font-bold"
                    >
                      DOWNLOAD
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
