import React, { useState, useRef, useEffect } from 'react';
import { RoomState, BundleItem, TransferProgress, SystemLogEntry } from '../types';
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
} from '../lib/p2pEngine';

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
  const [targetPeer, setTargetPeer] = useState<string>('OP_02');
  const [isDragging, setIsDragging] = useState(false);
  const [webrtcState, setWebrtcState] = useState<WebRTCConnectionState>('connected');
  const [errorToasts, setErrorToasts] = useState<ErrorToast[]>([]);
  
  const [logs, setLogs] = useState<SystemLogEntry[]>(room.bundleItems ? [
    createLogEntry('PEER_CONNECTED', '127.0.0.1', 'info'),
    createLogEntry('WEBRTC_STABLE', 'TRUE', 'success'),
    createLogEntry('ENCRYPTION', 'AES-256-GCM', 'encryption'),
    createLogEntry('LATENCY', '24MS', 'info'),
    createLogEntry('BITRATE', '12.4 MB/S', 'success'),
  ] : []);

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

  // Initialize WebRTC engine lifecycle
  useEffect(() => {
    const peerEngine = new WebRTCPeerEngine(room.id, 'OP_01');

    peerEngine.onStateChange = (state) => {
      setWebrtcState(state);
      setLogs((prev) => [
        ...prev.slice(-6),
        createLogEntry('ICE_STATE_CHANGE', state.toUpperCase(), state === 'connected' ? 'success' : 'warning'),
      ]);
    };

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

  // Auto-simulate WebRTC logs periodically
  useEffect(() => {
    const logEvents = [
      { label: 'PEER_HANDSHAKE', value: 'ACK_OK', type: 'success' },
      { label: 'ICE_CANDIDATE', value: 'HOST_READY', type: 'info' },
      { label: 'DATACHANNEL_PING', value: '18MS', type: 'info' },
      { label: 'ENCRYPTION_KEY', value: 'ROTATED', type: 'encryption' },
    ];

    const interval = setInterval(() => {
      const randomEv = logEvents[Math.floor(Math.random() * logEvents.length)];
      setLogs((prev) => [
        ...prev.slice(-6),
        createLogEntry(randomEv.label, randomEv.value, randomEv.type as any),
      ]);
    }, 9000);

    return () => clearInterval(interval);
  }, []);

  const handleCopyOTP = () => {
    navigator.clipboard.writeText(room.id).then(() => {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 1500);
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

    await new Promise<void>((resolve) => {
      let chunk = 0;
      const totalChunks = Math.max(3, Math.min(20, Math.ceil(fileSize / (256 * 1024))));

      const timer = setInterval(() => {
        chunk++;
        const percent = Math.min(100, Math.round((chunk / totalChunks) * 100));
        const bytesDone = Math.round((percent / 100) * fileSize);
        const currentSpeed = parseFloat((12 + Math.random() * 6).toFixed(1));

        setTransfer((prev) =>
          prev
            ? {
                ...prev,
                transferredBytes: bytesDone,
                progressPercent: percent,
                currentSpeedMBps: currentSpeed,
                encryptedChunksCount: chunk,
                etaSeconds: Math.max(0, Math.ceil((fileSize - bytesDone) / (currentSpeed * 1024 * 1024))),
              }
            : null
        );

        if (chunk >= totalChunks) {
          clearInterval(timer);

          const blob = new Blob([fileArrayBuffer!], { type: fileType });
          const blobUrl = URL.createObjectURL(blob);

          const fileLabel = 'label' in file ? file.label : getFileTypeLabel(fileType, fileName);

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
            uploaderId: 'OP_01',
            uploaderName: 'OP_01',
            timestamp: Date.now(),
            carbonFootprintGrams: carbon.p2pCarbonGrams,
            peerSeeds: room.activePeers.length,
            encryptionStatus: 'AES-256-GCM VERIFIED',
          };

          onAddBundleItem(newItem);

          setLogs((prev) => [
            ...prev,
            createLogEntry('AES256_TRANSFER_DONE', fileName, 'success'),
            createLogEntry('CARBON_SAVED', `${carbon.savedGrams}g CO2e`, 'info'),
          ]);

          resolve();
        }
      }, 70);
    });
  };

  const handleFilesSelect = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    for (let i = 0; i < fileList.length; i++) {
      await processSingleFile(fileList[i], { current: i + 1, total: fileList.length });
    }

    setTimeout(() => setTransfer(null), 800);
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
    <div className="mesh-bg min-h-screen pt-20 pb-48 px-6 md:px-12 max-w-[1200px] mx-auto flex flex-col selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Mesh Background Orbs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Hidden file input supporting multiple files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelect(e.target.files)}
      />

      {/* Room Header: OTP & Active Members */}
      <section className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center py-6 md:py-8 gap-6 border-b border-white/10">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-bold text-white/50 uppercase tracking-wider">
            // ACTIVE_EPHEMERAL_ROOM_ID
          </span>
          <div
            className="flex items-center gap-3 group cursor-pointer"
            onClick={handleCopyOTP}
            title="Click to Copy Room OTP"
          >
            <h1 className="font-mono text-3xl md:text-5xl font-bold tracking-widest text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              {copiedOtp ? 'COPIED' : room.id}
            </h1>
            <span className="material-symbols-outlined text-blue-400 group-hover:scale-110 transition-transform">
              content_copy
            </span>
          </div>
        </div>

        {/* Peer Avatars & Status */}
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {room.activePeers.map((peer) => (
              <div key={peer.id} className="relative group">
                <div
                  className={`w-11 h-11 md:w-12 md:h-12 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center font-mono text-xs font-bold transition-all ${
                    peer.isYou
                      ? 'border border-blue-400 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                      : 'border border-white/20 text-white/70'
                  }`}
                >
                  {peer.name}
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6] animate-pulse"></div>
              </div>
            ))}
            <button
              onClick={handleCopyOTP}
              className="w-11 h-11 md:w-12 md:h-12 border border-dashed border-white/30 rounded-xl flex items-center justify-center text-white/50 hover:border-blue-400 hover:text-blue-400 transition-all cursor-pointer bg-white/[0.02]"
              title="Invite Peer"
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  webrtcState === 'connected' || webrtcState === 'completed'
                    ? 'bg-blue-400 animate-pulse'
                    : webrtcState === 'checking'
                    ? 'bg-yellow-400 animate-ping'
                    : 'bg-red-400'
                }`}
              ></span>
              {room.activePeers.length}_PEERS_LIVE
            </span>
            <span className="font-mono text-[11px] text-blue-400 uppercase">
              ICE_{webrtcState.toUpperCase()}
            </span>
          </div>

          <button
            onClick={onLeaveRoom}
            className="ml-4 border border-white/20 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 text-xs font-mono px-4 py-2 rounded-xl text-white/70 transition-all cursor-pointer"
          >
            LEAVE
          </button>
        </div>
      </section>

      {/* Drop Zone (The Package - Direct 1:1 Target) */}
      <section
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative z-10 flex-grow flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all my-6 p-8 min-h-[340px] backdrop-blur-xl ${
          isDragging
            ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
            : 'border-white/15 bg-white/[0.02] hover:border-blue-400/50 hover:bg-white/[0.04]'
        }`}
      >
        {/* Target Selector Dropdown */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 border border-white/20 px-3.5 py-1.5 rounded-xl font-mono text-xs backdrop-blur-md">
          <span className="text-white/50">TARGET_PEER:</span>
          <select
            value={targetPeer}
            onChange={(e) => setTargetPeer(e.target.value)}
            className="bg-transparent text-blue-400 font-mono font-bold focus:outline-none cursor-pointer"
          >
            <option value="OP_02" className="bg-[#131313] text-white">
              OP_02 (Direct Package 1:1)
            </option>
            <option value="ALL_BUNDLE" className="bg-[#131313] text-white">
              ALL PEERS (Room Bundle Pool)
            </option>
          </select>
        </div>

        <div className="absolute top-4 right-4 font-mono text-xs text-white/20">E2EE_ACTIVE</div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-lg my-auto">
          <div className="w-20 h-20 mb-5 border border-white/20 rounded-2xl flex items-center justify-center text-white/60 group-hover:border-blue-400 group-hover:text-blue-400 transition-colors duration-300 bg-white/5 backdrop-blur-md">
            <span className="material-symbols-outlined text-4xl text-blue-400">upload_file</span>
          </div>

          <h2 className="text-xl md:text-2xl font-geist font-bold text-white mb-2">
            DROP_TO_USER: <span className="text-blue-400">{targetPeer}</span>
          </h2>
          <p className="font-mono text-xs text-white/60 mb-6 uppercase tracking-wider">
            Drop multiple files or share raw text, code, essays & notes
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="frosted-button-primary px-7 py-3.5 rounded-xl font-mono text-xs font-bold tracking-widest hover:scale-105 active:scale-95 cursor-pointer shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">file_upload</span>
              SELECT_FILES (MULTI)
            </button>

            <button
              onClick={() => setIsTextModalOpen(true)}
              className="px-6 py-3.5 bg-white/5 border border-white/20 hover:border-blue-400 hover:bg-white/10 text-white rounded-xl font-mono text-xs font-bold tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-blue-400">code</span>
              SHARE_TEXT / CODE
            </button>
          </div>

          {/* Active Transfer Gauge / Progress */}
          {transfer && (
            <div className="w-full mt-6 p-4 border border-blue-400/50 bg-black/80 backdrop-blur-2xl rounded-2xl font-mono text-xs text-left space-y-2 shadow-2xl animate-in fade-in">
              <div className="flex justify-between text-white font-bold">
                <span className="truncate pr-2">{transfer.fileName}</span>
                <span className="text-blue-400">{transfer.progressPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-white/10 overflow-hidden rounded-full border border-white/20">
                <div
                  className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6] transition-all duration-150"
                  style={{ width: `${transfer.progressPercent}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-white/60 pt-1 border-t border-white/10">
                <div>
                  SPEED: <span className="text-white">{transfer.currentSpeedMBps} MB/s</span>
                </div>
                <div>
                  CHUNKS: <span className="text-blue-400">{transfer.encryptedChunksCount}/{transfer.totalChunks}</span>
                </div>
                <div>
                  ETA: <span className="text-white">{transfer.etaSeconds}s</span>
                </div>
                <div>
                  CARBON: <span className="text-emerald-400">{transfer.carbonEmittedGrams}g CO2e</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4 font-mono text-xs text-white/20">
          FLUX_STABLE_0.8.2
        </div>
      </section>

      {/* Share Text / Code / Essay Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
            onClick={() => setIsTextModalOpen(false)}
          ></div>

          <div className="relative w-full max-w-2xl bg-[#18181b] border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col p-6 space-y-5">
            <header className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-blue-400 text-2xl">code_blocks</span>
                <h3 className="font-geist text-xl font-bold text-white tracking-tight">
                  Share Text / Code / Essay
                </h3>
              </div>
              <button
                onClick={() => setIsTextModalOpen(false)}
                className="text-white/50 hover:text-white p-1 rounded-lg border border-white/10"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </header>

            <form onSubmit={handleShareTextSnippet} className="flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="font-mono text-[11px] font-bold text-white/60 uppercase tracking-widest">
                    SNIPPET_TITLE / FILENAME
                  </label>
                  <input
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="e.g. essay_draft.txt or script.py"
                    className="input-underlined w-full px-3.5 py-2 font-mono text-xs text-white bg-white/5 border border-white/10 rounded-xl focus:border-blue-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="font-mono text-[11px] font-bold text-white/60 uppercase tracking-widest">
                    CONTENT_TYPE
                  </label>
                  <select
                    value={textCategory}
                    onChange={(e: any) => setTextCategory(e.target.value)}
                    className="w-full px-3.5 py-2 font-mono text-xs text-blue-400 bg-[#1f1f23] border border-white/10 rounded-xl focus:border-blue-400 focus:outline-none cursor-pointer"
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
                  <label className="font-mono text-[11px] font-bold text-white/60 uppercase tracking-widest">
                    TEXT_PAYLOAD_BODY
                  </label>
                  <span className="font-mono text-[10px] text-white/40">
                    {textContentInput.length} CHARS // {textContentInput.split('\n').length} LINES
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={textContentInput}
                  onChange={(e) => setTextContentInput(e.target.value)}
                  placeholder="Paste or write code snippets, essays, paragraphs, or Markdown notes here..."
                  className="w-full p-4 font-mono text-xs text-blue-200 bg-black/60 border border-white/10 rounded-xl focus:border-blue-400 focus:outline-none resize-none custom-scrollbar leading-relaxed"
                  required
                ></textarea>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  AES-256-GCM ENCRYPTED IN RAM
                </span>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTextModalOpen(false)}
                    className="px-4 py-2.5 border border-white/20 text-white/70 hover:text-white font-mono text-xs rounded-xl cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="frosted-button-primary px-6 py-2.5 font-mono text-xs font-bold rounded-xl tracking-wider cursor-pointer shadow-lg flex items-center gap-2"
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
      <div className="fixed bottom-32 right-6 md:right-12 z-40 w-72 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl hidden sm:block">
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
          <span className="font-mono text-xs font-bold text-blue-400">SYSTEM_LOG</span>
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></span>
        </div>

        <div className="space-y-1.5 font-mono text-[11px] max-h-36 overflow-y-auto custom-scrollbar pr-1">
          {logs.map((log) => (
            <div key={log.id} className="flex justify-between items-center text-xs">
              <span className="text-white/50 truncate pr-2">{log.label}:</span>
              <span
                className={
                  log.type === 'success'
                    ? 'text-emerald-400'
                    : log.type === 'encryption'
                    ? 'text-blue-400'
                    : 'text-white'
                }
              >
                {log.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Tray (The Bundle - Collective Pool) */}
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-black/50 backdrop-blur-2xl border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-400">layers</span>
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                SHARED_BUNDLE ({room.bundleItems.length})
              </span>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDownloadAll}
                className="font-mono text-xs font-bold text-blue-400 hover:text-white transition-colors cursor-pointer"
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
                className="flex-shrink-0 w-64 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:border-blue-400/50 hover:bg-white/[0.06] transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/70 group-hover:text-blue-400 transition-colors">
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
                    className="p-1 text-white/50 hover:text-blue-400 transition-colors cursor-pointer"
                    title="Download File"
                  >
                    <span className="material-symbols-outlined text-xl">download</span>
                  </button>
                </div>

                <h3 className="font-mono text-xs text-white font-bold mb-1 truncate">
                  {item.name}
                </h3>

                <div className="flex justify-between font-mono text-[11px] text-white/60">
                  <span>{formatBytes(item.size)}</span>
                  <span className="text-blue-400">{item.fileTypeLabel}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-white/10 flex justify-between font-mono text-[10px] text-emerald-400">
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
    </div>
  );
};
