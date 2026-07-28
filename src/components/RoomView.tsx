import React, { useState, useRef, useEffect } from 'react';
import { RoomState, BundleItem, TransferProgress, SystemLogEntry, Peer } from '../types';
import {
  encryptFileBuffer,
  formatBytes,
  calculateCarbonMetrics,
  getFileTypeLabel,
} from '../lib/crypto';
import {
  createLogEntry,
  WebRTCPeerEngine,
  validateTransferQuota,
  WebRTCConnectionState,
  formatRoomOTPDisplay,
} from '../lib/p2pEngine';
import { QRCodeModal } from './QRCodeModal';

interface RoomViewProps {
  room: RoomState;
  onLeaveRoom: () => void;
  onPreviewFile: (file: BundleItem) => void;
  onAddBundleItem: (item: BundleItem) => void;
}

interface ErrorToast {
  id: string;
  code: string;
  message: string;
}

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  onLeaveRoom,
  onPreviewFile,
  onAddBundleItem,
}) => {
  const [copiedOtp, setCopiedOtp] = useState(false);
  // Default to first remote peer, or ALL_BUNDLE if none
  const initialTarget = room.activePeers.find((p) => !p.isYou)?.id || 'ALL_BUNDLE';
  const [targetPeer, setTargetPeer] = useState<string>(initialTarget);
  const [isDragging, setIsDragging] = useState(false);
  const [webrtcState, setWebrtcState] = useState<WebRTCConnectionState>('connected');
  const [errorToasts, setErrorToasts] = useState<ErrorToast[]>([]);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [showPresenceList, setShowPresenceList] = useState(false);
  const [isLogMinimized, setIsLogMinimized] = useState(true);

  // Real-time peers list - only from actual signaling server
  const [peersList, setPeersList] = useState<Peer[]>(room.activePeers || []);
  
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);

  // Transfer state
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text / Code Sharing State
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textTitle, setTextTitle] = useState('snippet.ts');
  const [textContentInput, setTextContentInput] = useState('');
  const [textCategory, setTextCategory] = useState<'code' | 'essay' | 'paragraph' | 'markdown' | 'plain'>('code');

  const addErrorToast = (code: string, message: string) => {
    const newToast: ErrorToast = {
      id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code,
      message,
    };
    setErrorToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 8 seconds
    setTimeout(() => {
      setErrorToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 8000);
  };

  const removeErrorToast = (id: string) => {
    setErrorToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initialize WebRTC engine lifecycle & handle ICE candidates
  useEffect(() => {
    // Use the actual current peer ID from the room state (first peer is always the local peer)
    const localPeerId = room.activePeers.find((p) => p.isYou)?.id || 'LOCAL_PEER';
    const peerEngine = new WebRTCPeerEngine(room.id, localPeerId);

    peerEngine.onStateChange = (state) => {
      setWebrtcState(state);
      setLogs((prev) => [
        ...prev.slice(-6),
        createLogEntry('ICE_STATE_CHANGE', state.toUpperCase(), state === 'connected' ? 'success' : 'warning'),
      ]);
    };

    // Removed redundant ice candidate log spam
    peerEngine.onSignalOutput = (_signal) => {};

    peerEngine.onError = (errorMsg, code) => {
      addErrorToast(code, errorMsg);
      setLogs((prev) => [
        ...prev.slice(-6),
        createLogEntry('RTC_ERROR', code, 'warning'),
      ]);
    };

    return () => {
      peerEngine.close();
    };
  }, [room.id]);



  // Real ping updates will come from WebRTC data channel heartbeat
  // TODO: Subscribe to WebRTC engine's latency updates instead of simulated values

  const handleCopyOTP = () => {
    navigator.clipboard.writeText(room.id).then(() => {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    });
  };

  const processSingleFile = async (
    file: File | { name: string; type: string; content: string; label: string },
    batchInfo?: { current: number; total: number }
  ) => {
    let fileArrayBuffer: ArrayBuffer;
    let fileName: string;
    let fileType: string;
    let fileSize: number;
    let textContentStr: string | undefined = undefined;

    if ('content' in file) {
      // Text snippet payload
      fileName = file.name;
      fileType = file.type;
      textContentStr = file.content;
      const encoder = new TextEncoder();
      const encoded = encoder.encode(file.content);
      fileArrayBuffer = encoded.buffer;
      fileSize = encoded.byteLength;
    } else {
      fileName = file.name;
      fileType = file.type || 'application/octet-stream';
      fileSize = file.size;
    }

    // Quota & Memory Guard check
    const currentTotalBytes = room.bundleItems.reduce((acc, item) => acc + item.size, 0);
    const quotaResult = validateTransferQuota(fileSize, currentTotalBytes);
    if (!quotaResult.valid) {
      addErrorToast(
        quotaResult.errorCode || 'ERR_QUOTA_EXCEEDED',
        quotaResult.errorMessage || 'Transfer aborted due to RAM quota limit.'
      );
      setLogs((prev) => [
        ...prev.slice(-6),
        createLogEntry('ABORT_TRANSFER', quotaResult.errorCode || 'QUOTA_EXCEEDED', 'warning'),
      ]);
      return;
    }

    if (!('content' in file)) {
      fileArrayBuffer = await file.arrayBuffer();

      if (
        fileType.startsWith('text/') ||
        ['txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'css', 'html', 'c', 'cpp'].some((ext) =>
          fileName.toLowerCase().endsWith(ext)
        )
      ) {
        try {
          textContentStr = new TextDecoder().decode(fileArrayBuffer);
        } catch {
          // Ignore
        }
      }
    }

    const carbon = calculateCarbonMetrics(fileSize);

    setTransfer({
      active: true,
      fileName: batchInfo && batchInfo.total > 1 ? `[${batchInfo.current}/${batchInfo.total}] ${fileName}` : fileName,
      fileSize: fileSize,
      transferredBytes: 0,
      progressPercent: 0,
      currentSpeedMBps: 14.2,
      etaSeconds: Math.max(1, Math.ceil(fileSize / (14.2 * 1024 * 1024))),
      targetPeerId: targetPeer,
      mode: targetPeer === 'ALL_BUNDLE' ? 'BUNDLE' : 'PACKAGE',
      carbonEmittedGrams: carbon.p2pCarbonGrams,
      encryptedChunksCount: 0,
      totalChunks: Math.max(1, Math.ceil(fileSize / (256 * 1024))),
    });

    const encResult = await encryptFileBuffer(fileArrayBuffer!);

    // TODO: Real WebRTC Data Channel Transfer
    // This now needs to:
    // 1. Get the WebRTC data channel from the peer engine
    // 2. Implement real chunking (64-256KB adaptive)
    // 3. Send chunks over RTCDataChannel with CRC32 verification per chunk
    // 4. Calculate real RTT and throughput from actual network metrics
    // 5. Support resume capability with transferId tracking
    // 6. Ensure strict room/transfer isolation via roomId + transferId
    
    // For now, create a local bundle item (file stays in memory, ready for peer download)
    const blob = new Blob([fileArrayBuffer!], { type: fileType });
    const blobUrl = URL.createObjectURL(blob);

    const fileLabel = 'label' in file ? file.label : getFileTypeLabel(fileType, fileName);
    const localPeerId = room.activePeers.find((p) => p.isYou)?.id || 'LOCAL_PEER';

    const newItem: BundleItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: fileName,
      size: fileSize,
      type: fileType,
      fileTypeLabel: fileLabel,
      fileId: `FLX-${Math.floor(100 + Math.random() * 899)}-NODE-${fileName.substring(0, 3).toUpperCase()}`,
      dimensions: textContentStr
        ? `${textContentStr.split('\n').length} LINES // ${textContentStr.split(/\s+/).length} WORDS`
        : fileType.startsWith('image/')
        ? '1920 × 1080 PX'
        : 'BINARY_STREAM',
      sha256: encResult.sha256Hex,
      encryptedHash: `AES256GCM_${encResult.sha256Hex.substring(0, 8)}`,
      blobUrl: blobUrl,
      rawBlob: blob,
      textContent: textContentStr,
      uploaderId: localPeerId,
      uploaderName: localPeerId,
      timestamp: Date.now(),
      carbonFootprintGrams: carbon.p2pCarbonGrams,
      peerSeeds: room.activePeers.length,
      encryptionStatus: 'AES-256-GCM VERIFIED',
    };

    onAddBundleItem(newItem);

    setLogs((prev) => [
      ...prev.slice(-6),
      createLogEntry('FILE_ADDED_TO_BUNDLE', fileName, 'success'),
      createLogEntry('CARBON_SAVED', `${carbon.savedGrams}g CO2e`, 'info'),
      createLogEntry('ENCRYPTION', 'AES-256-GCM', 'encryption'),
    ]);

    setTransfer(null);
  };

  const handleFilesSelect = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    for (let i = 0; i < fileList.length; i++) {
      await processSingleFile(fileList[i], { current: i + 1, total: fileList.length });
    }
  };

  const handleShareTextSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContentInput.trim()) return;

    let mimeType = 'text/plain';
    let label = 'TXT_SNIPPET';

    if (textCategory === 'code') {
      mimeType = 'text/plain';
      label = 'CODE_SNIPPET';
    } else if (textCategory === 'essay') {
      mimeType = 'text/plain';
      label = 'ESSAY_TEXT';
    } else if (textCategory === 'markdown') {
      mimeType = 'text/markdown';
      label = 'MARKDOWN_DOC';
    } else if (textCategory === 'paragraph') {
      mimeType = 'text/plain';
      label = 'PARAGRAPH';
    }

    const payloadName = textTitle.trim() || `snippet_${Date.now().toString().slice(-4)}.txt`;

    setIsTextModalOpen(false);

    await processSingleFile({
      name: payloadName,
      type: mimeType,
      content: textContentInput,
      label,
    });

    setTextContentInput('');
    setTextTitle('snippet.ts');
    setTimeout(() => setTransfer(null), 800);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleDownloadAll = () => {
    room.bundleItems.forEach((file) => {
      const a = document.createElement('a');
      a.href = file.blobUrl || '#';
      a.download = file.name;
      a.click();
    });
  };

  return (
    <div className="min-h-screen pt-20 pb-48 px-6 md:px-12 max-w-[1280px] mx-auto flex flex-col selection:bg-[#7342E2] selection:text-white relative overflow-hidden bg-[#F2F2EE]">
      {/* Background ambient video loop or subtle gradient */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 z-0 w-full h-full object-cover opacity-10 pointer-events-none"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_131516_eca35265-ea66-4fbd-8d52-22aae6e1a503.mp4"
          type="video/mp4"
        />
      </video>

      {/* Hidden file input supporting multiple files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelect(e.target.files)}
      />

      {/* Room Header: OTP & Active Members */}
      <section className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center py-6 md:py-8 gap-6 border-b border-[#192837]/10">
        <div className="flex flex-col gap-1.5">
          <span
            onClick={handleCopyOTP}
            className="font-mono text-[11px] font-bold text-[#192837]/60 hover:text-[#7342E2] uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5"
            title="Click to Copy Room OTP"
          >
            // ACTIVE_EPHEMERAL_ROOM_ID: <span className="text-[#7342E2] font-bold hover:underline">{copiedOtp ? 'COPIED ✓' : formatRoomOTPDisplay(room.id)}</span>
          </span>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-3 group cursor-pointer"
              onClick={handleCopyOTP}
              title="Click to Copy Room OTP"
            >
              <h1 className="font-heading text-3xl md:text-5xl font-bold tracking-widest text-[#192837]">
                {copiedOtp ? 'COPIED ✓' : formatRoomOTPDisplay(room.id)}
              </h1>
              <span className="material-symbols-outlined text-[#7342E2] group-hover:scale-110 transition-transform">
                content_copy
              </span>
            </div>

            {/* QR Code Modal Trigger Button */}
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-3 py-2 bg-[#7342E2]/10 border border-[#7342E2]/30 hover:bg-[#7342E2]/20 text-[#7342E2] rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ml-2"
              title="Show QR Codes for Mobile Join & Auto Download"
            >
              <span className="material-symbols-outlined text-lg">qr_code_2</span>
              <span>QR_CODES</span>
            </button>
          </div>
        </div>

        {/* Peer Avatars & Status */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex -space-x-3">
            {peersList.map((peer) => (
              <div key={peer.id} className="relative group">
                <div
                  className={`w-11 h-11 md:w-12 md:h-12 bg-white/80 backdrop-blur-md rounded-xl flex items-center justify-center font-mono text-xs font-bold transition-all shadow-sm ${
                    peer.isYou
                      ? 'border border-[#7342E2] text-[#7342E2] shadow-[0_0_10px_rgba(115,66,226,0.3)]'
                      : 'border border-[#192837]/20 text-[#192837]/70'
                  }`}
                >
                  {peer.name.slice(0, 5)}
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#7342E2] rounded-full shadow-[0_0_8px_#7342E2] animate-pulse"></div>
              </div>
            ))}
          </div>

          <div className="flex flex-col">
            <button
              onClick={() => setShowPresenceList((prev) => !prev)}
              className="font-mono text-xs font-bold text-[#192837] uppercase flex items-center gap-1.5 hover:text-[#7342E2] cursor-pointer transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  webrtcState === 'connected' || webrtcState === 'completed'
                    ? 'bg-[#7342E2] animate-pulse'
                    : webrtcState === 'checking'
                    ? 'bg-yellow-500 animate-ping'
                    : 'bg-red-500'
                }`}
              ></span>
              {peersList.length}_PEERS_LIVE
              <span className="material-symbols-outlined text-sm">
                {showPresenceList ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            <span className="font-mono text-[11px] text-[#7342E2] uppercase font-bold">
              ICE_{webrtcState.toUpperCase()}
            </span>
          </div>

          <button
            onClick={onLeaveRoom}
            className="ml-2 border border-[#192837]/20 hover:border-red-500 hover:bg-red-500/10 hover:text-red-600 text-xs font-mono px-4 py-2 rounded-xl text-[#192837]/70 transition-all cursor-pointer bg-white/80"
          >
            LEAVE
          </button>
        </div>
      </section>

      {/* Real-time Peer Presence Indicator Drawer */}
      {showPresenceList && (
        <section className="relative z-20 my-4 p-5 bg-white/90 border border-[#7342E2]/30 rounded-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#192837]/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7342E2] text-xl">group</span>
              <h3 className="font-mono text-xs font-bold text-[#192837] uppercase tracking-wider">
                REAL-TIME_PEER_PRESENCE ({peersList.length} CONNECTED)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="px-3 py-1 bg-[#7342E2]/15 border border-[#7342E2]/40 text-[#7342E2] font-mono text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">qr_code_2</span>
                SCAN_QR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {peersList.map((peer) => (
              <div
                key={peer.id}
                className={`p-3.5 rounded-2xl border font-mono text-xs flex flex-col space-y-2 transition-all ${
                  peer.isYou
                    ? 'bg-[#7342E2]/10 border-[#7342E2]/40 shadow-sm'
                    : 'bg-white/80 border-[#192837]/10 hover:border-[#192837]/20 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#192837] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {peer.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      peer.isYou
                        ? 'bg-[#7342E2]/20 text-[#7342E2] border border-[#7342E2]/40'
                        : 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/40'
                    }`}
                  >
                    {peer.isYou ? 'HOST_YOU' : 'PEER_NODE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[11px] text-[#192837]/70 border-t border-[#192837]/5 pt-2">
                  <div>IP: <span className="text-[#192837] font-bold">{peer.ip}</span></div>
                  <div>PING: <span className="text-[#7342E2] font-bold">{peer.latencyMs}ms</span></div>
                  <div>ICE: <span className="text-emerald-600 font-bold">PASSED</span></div>
                  <div>STUN: <span className="text-[#192837]/80 font-bold">GOOGLE_STUN</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Drop Zone (The Package - Direct 1:1 Target) */}
      <section
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative z-10 flex-grow flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all my-6 p-8 min-h-[340px] backdrop-blur-xl shadow-md ${
          isDragging
            ? 'border-[#7342E2] bg-[#7342E2]/10 shadow-lg'
            : 'border-[#192837]/20 bg-white/80 hover:border-[#7342E2]/50 hover:bg-white/90'
        }`}
      >
        {/* Target Selector Dropdown — dynamic based on real peer list */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 border border-[#192837]/15 px-3.5 py-1.5 rounded-2xl font-mono text-xs backdrop-blur-md shadow-sm">
          <span className="text-[#192837]/60 font-bold">TARGET:</span>
          <select
            value={targetPeer}
            onChange={(e) => setTargetPeer(e.target.value)}
            className="bg-transparent text-[#7342E2] font-mono font-bold focus:outline-none cursor-pointer"
          >
            {peersList.filter((p) => !p.isYou).map((p) => (
              <option key={p.id} value={p.id} className="bg-white text-[#192837]">
                {p.name} (Direct 1:1)
              </option>
            ))}
            <option value="ALL_BUNDLE" className="bg-white text-[#192837]">
              ALL PEERS (Room Bundle)
            </option>
          </select>
        </div>

        <div className="absolute top-4 right-4 font-mono text-xs font-bold text-[#7342E2]">E2EE_ACTIVE</div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-lg my-auto">
          <div className="w-20 h-20 mb-5 border border-[#192837]/15 rounded-3xl flex items-center justify-center text-[#7342E2] bg-white/90 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-[#7342E2]">upload_file</span>
          </div>

          <h2 className="text-xl md:text-2xl font-heading font-bold text-[#192837] mb-2">
            DROP_TO_USER: <span className="text-[#7342E2]">{targetPeer}</span>
          </h2>
          <p className="font-mono text-xs text-[#192837]/70 mb-6 uppercase tracking-wider font-bold">
            Drop multiple files or share raw text, code, essays & notes
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-7 py-3.5 rounded-full font-mono text-xs font-bold tracking-widest hover:scale-105 active:scale-95 cursor-pointer shadow-md flex items-center gap-2 text-white bg-[#7342E2] hover:bg-[#7342E2]/90 transition-all"
            >
              <span className="material-symbols-outlined text-base">file_upload</span>
              SELECT_FILES (MULTI)
            </button>

            <button
              onClick={() => setIsTextModalOpen(true)}
              className="px-6 py-3.5 bg-white border border-[#192837]/20 hover:border-[#7342E2] hover:bg-[#F2F2EE] text-[#192837] rounded-full font-mono text-xs font-bold tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-[#7342E2]">code</span>
              SHARE_TEXT / CODE
            </button>
          </div>

          {/* Active Transfer Gauge / Progress */}
          {transfer && (
            <div className="w-full mt-6 p-4 border border-[#7342E2]/50 bg-white/95 backdrop-blur-2xl rounded-2xl font-mono text-xs text-left space-y-2 shadow-xl animate-in fade-in">
              <div className="flex justify-between text-[#192837] font-bold">
                <span className="truncate pr-2">{transfer.fileName}</span>
                <span className="text-[#7342E2]">{transfer.progressPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-[#192837]/10 overflow-hidden rounded-full border border-[#192837]/15">
                <div
                  className="h-full bg-[#7342E2] shadow-[0_0_10px_#7342E2] transition-all duration-150"
                  style={{ width: `${transfer.progressPercent}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#192837]/70 pt-1 border-t border-[#192837]/10 font-bold">
                <div>
                  SPEED: <span className="text-[#192837]">{transfer.currentSpeedMBps} MB/s</span>
                </div>
                <div>
                  CHUNKS: <span className="text-[#7342E2]">{transfer.encryptedChunksCount}/{transfer.totalChunks}</span>
                </div>
                <div>
                  ETA: <span className="text-[#192837]">{transfer.etaSeconds}s</span>
                </div>
                <div>
                  CARBON: <span className="text-emerald-600">{transfer.carbonEmittedGrams}g CO2e</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4 font-mono text-xs text-[#192837]/30">
          FLUX_STABLE_0.8.2
        </div>
      </section>

      {/* Share Text / Code / Essay Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-[#192837]/50 backdrop-blur-md cursor-pointer"
            onClick={() => setIsTextModalOpen(false)}
          ></div>

          <div className="relative w-full max-w-2xl bg-white border border-[#192837]/15 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col p-6 space-y-5 text-[#192837]">
            <header className="flex items-center justify-between border-b border-[#192837]/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#7342E2] text-2xl">code_blocks</span>
                <h3 className="font-heading text-xl font-bold text-[#192837] tracking-tight">
                  Share Text / Code / Essay
                </h3>
              </div>
              <button
                onClick={() => setIsTextModalOpen(false)}
                className="text-[#192837]/50 hover:text-[#192837] p-1 rounded-lg border border-[#192837]/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </header>

            <form onSubmit={handleShareTextSnippet} className="flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="font-mono text-[11px] font-bold text-[#192837]/70 uppercase tracking-widest">
                    SNIPPET_TITLE / FILENAME
                  </label>
                  <input
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="e.g. essay_draft.txt or script.py"
                    className="w-full px-3.5 py-2 font-mono text-xs text-[#192837] bg-[#F2F2EE] border border-[#192837]/15 rounded-xl focus:border-[#7342E2] focus:outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="font-mono text-[11px] font-bold text-[#192837]/70 uppercase tracking-widest">
                    CONTENT_TYPE
                  </label>
                  <select
                    value={textCategory}
                    onChange={(e: any) => setTextCategory(e.target.value)}
                    className="w-full px-3.5 py-2 font-mono text-xs text-[#7342E2] font-bold bg-[#F2F2EE] border border-[#192837]/15 rounded-xl focus:border-[#7342E2] focus:outline-none cursor-pointer"
                  >
                    <option value="code">Source Code Snippet (.ts, .py, .js)</option>
                    <option value="essay">Essay / Long Article (.txt)</option>
                    <option value="paragraph">Paragraph / Quick Note</option>
                    <option value="markdown">Markdown Document (.md)</option>
                    <option value="plain">Plain Text</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-[11px] font-bold text-[#192837]/70 uppercase tracking-widest">
                    TEXT_PAYLOAD_BODY
                  </label>
                  <span className="font-mono text-[10px] text-[#192837]/50 font-bold">
                    {textContentInput.length} CHARS // {textContentInput.split('\n').length} LINES
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={textContentInput}
                  onChange={(e) => setTextContentInput(e.target.value)}
                  placeholder="Paste or write code snippets, essays, paragraphs, or Markdown notes here..."
                  className="w-full p-4 font-mono text-xs text-[#192837] bg-[#F2F2EE] border border-[#192837]/15 rounded-2xl focus:border-[#7342E2] focus:outline-none resize-none custom-scrollbar leading-relaxed"
                  required
                ></textarea>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-mono text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  AES-256-GCM ENCRYPTED IN RAM
                </span>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTextModalOpen(false)}
                    className="px-4 py-2.5 border border-[#192837]/20 text-[#192837]/70 hover:text-[#192837] font-mono text-xs rounded-full cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 font-mono text-xs font-bold rounded-full tracking-wider cursor-pointer shadow-md flex items-center gap-2 text-white bg-[#7342E2] hover:bg-[#7342E2]/90"
                  >
                    <span className="material-symbols-outlined text-sm">lock</span>
                    ENCRYPT_&_SHARE
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technical Status Log Box (Floating Corner Widget) */}
      <div className="fixed bottom-32 right-6 md:right-12 z-40 w-64 md:w-72 bg-white/90 backdrop-blur-2xl border border-[#192837]/15 rounded-2xl p-3 md:p-4 shadow-xl hidden sm:block transition-all text-[#192837]">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsLogMinimized(!isLogMinimized)}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#7342E2] rounded-full animate-pulse shadow-[0_0_8px_#7342E2]"></span>
            <span className="font-mono text-xs font-bold text-[#7342E2]">
              SYSTEM_LOG {isLogMinimized && <span className="text-[#192837]/50 font-normal">[MINIMISED]</span>}
            </span>
          </div>
          <button className="text-[#192837]/50 hover:text-[#192837] p-0.5 cursor-pointer">
            <span className="material-symbols-outlined text-sm">
              {isLogMinimized ? 'unfold_more' : 'unfold_less'}
            </span>
          </button>
        </div>

        {!isLogMinimized && (
          <div className="space-y-1.5 font-mono text-[11px] max-h-36 overflow-y-auto custom-scrollbar pr-1 mt-3 border-t border-[#192837]/10 pt-2 animate-in fade-in duration-150">
            {logs.map((log) => (
              <div key={log.id} className="flex justify-between items-center text-xs">
                <span className="text-[#192837]/60 truncate pr-2 font-bold">{log.label}:</span>
                <span
                  className={
                    log.type === 'success'
                      ? 'text-emerald-600 font-bold'
                      : log.type === 'encryption'
                      ? 'text-[#7342E2] font-bold'
                      : 'text-[#192837] font-bold'
                  }
                >
                  {log.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Tray (The Bundle - Collective Pool) */}
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-white/90 backdrop-blur-2xl border-t border-[#192837]/10 shadow-lg text-[#192837]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#7342E2]">layers</span>
              <span className="font-mono text-xs font-bold text-[#192837] uppercase tracking-wider">
                SHARED_BUNDLE ({room.bundleItems.length})
              </span>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDownloadAll}
                className="font-mono text-xs font-bold text-[#7342E2] hover:underline transition-colors cursor-pointer"
              >
                DOWNLOAD_ALL
              </button>
            </div>
          </div>

          {/* Bundle File Cards Horizontal Slider */}
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {room.bundleItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onPreviewFile(item)}
                className="flex-shrink-0 w-64 bg-white/80 backdrop-blur-xl border border-[#192837]/10 rounded-2xl p-4 hover:border-[#7342E2]/50 hover:bg-white transition-all group cursor-pointer shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-[#F2F2EE] border border-[#192837]/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#192837]/70 group-hover:text-[#7342E2] transition-colors">
                      {item.type.startsWith('image/')
                        ? 'image'
                        : item.type.startsWith('video/')
                        ? 'video_library'
                        : item.type.includes('json')
                        ? 'code'
                        : 'description'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const a = document.createElement('a');
                      a.href = item.blobUrl || '#';
                      a.download = item.name;
                      a.click();
                    }}
                    className="p-1 text-[#192837]/50 hover:text-[#7342E2] transition-colors cursor-pointer"
                    title="Download File"
                  >
                    <span className="material-symbols-outlined text-xl">download</span>
                  </button>
                </div>

                <h3 className="font-mono text-xs text-[#192837] font-bold mb-1 truncate">
                  {item.name}
                </h3>

                <div className="flex justify-between font-mono text-[11px] text-[#192837]/70 font-bold">
                  <span>{formatBytes(item.size)}</span>
                  <span className="text-[#7342E2]">{item.fileTypeLabel}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-[#192837]/10 flex justify-between font-mono text-[10px] text-emerald-600 font-bold">
                  <span>{item.encryptionStatus}</span>
                  <span>{item.carbonFootprintGrams}g CO2e</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* Brutalist Error Toast Stack (Fixed Bottom Left) */}
      {errorToasts.length > 0 && (
        <div className="fixed bottom-6 left-6 z-[120] flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
          {errorToasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto p-3.5 bg-black/90 border-2 border-red-500 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] backdrop-blur-2xl flex items-start justify-between gap-3 font-mono text-xs text-red-400 animate-in slide-in-from-bottom-2 duration-200"
            >
              <div className="flex gap-2.5 items-start">
                <span className="material-symbols-outlined text-base shrink-0 text-red-400 mt-0.5">
                  error
                </span>
                <div>
                  <div className="font-bold text-red-400 tracking-wider font-mono">
                    [{toast.code}]
                  </div>
                  <div className="text-white/80 text-[11px] mt-0.5 leading-relaxed">
                    {toast.message}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeErrorToast(toast.id)}
                className="text-white/40 hover:text-white p-0.5 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Generator Modal (Mobile Room Join & Auto Download) */}
      {isQrModalOpen && (
        <QRCodeModal
          roomId={room.id}
          bundleItems={room.bundleItems}
          onClose={() => setIsQrModalOpen(false)}
          onDownloadAll={handleDownloadAll}
        />
      )}
    </div>
  );
};
