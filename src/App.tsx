import React, { useState, useEffect } from 'react';
import { ViewMode, UserSession, RoomState, BundleItem } from './types';
import { Navbar } from './components/Navbar';
import { AuthScreen } from './components/AuthScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { RoomView } from './components/RoomView';
import { FilePreviewModal } from './components/FilePreviewModal';
import { NetworkTopologyScreen } from './components/NetworkTopologyScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { HeroSection } from './components/HeroSection';
import { DEFAULT_BUNDLE_ITEMS } from './data/defaultFiles';
import { generateRoomOTP } from './lib/p2pEngine';
import { auth, onAuthStateChanged, signOut } from './lib/firebase';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('AUTH');
  const [session, setSession] = useState<UserSession | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [showAuthScreen, setShowAuthScreen] = useState(false);

  const [latencyMs, setLatencyMs] = useState(24);

  // Active Room State
  const [room, setRoom] = useState<RoomState>({
    id: 'X-R92-K',
    createdAt: Date.now(),
    hostId: 'OP_01',
    activePeers: [
      { id: 'OP_01', name: 'OP_01', isYou: true, status: 'ONLINE', latencyMs: 0, ip: '127.0.0.1' },
      { id: 'OP_02', name: 'OP_02', isYou: false, status: 'ONLINE', latencyMs: 24, ip: '192.168.1.42' },
    ],
    bundleItems: DEFAULT_BUNDLE_ITEMS,
    selectedTargetPeerId: 'OP_02',
  });

  // Modal State
  const [previewFile, setPreviewFile] = useState<BundleItem | null>(null);

  // Sync with Firebase Auth state & handle URL deep-links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const actionParam = params.get('action');

    if (roomParam) {
      setRoom((prev) => ({
        ...prev,
        id: roomParam.toUpperCase(),
      }));
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userSession: UserSession = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          identifier: firebaseUser.email || firebaseUser.uid,
          authenticated: true,
          nodeType: 'EPH_NODE_0.4.2',
          encryptionAlgorithm: 'AES-256-GCM',
        };
        setSession(userSession);

        if (roomParam) {
          setCurrentView('ROOM');
          if (actionParam === 'download_bundle') {
            setTimeout(() => {
              // Trigger auto-download
              DEFAULT_BUNDLE_ITEMS.forEach((file) => {
                if (file.blobUrl) {
                  const a = document.createElement('a');
                  a.href = file.blobUrl;
                  a.download = file.name;
                  a.click();
                }
              });
            }, 1000);
          }
        } else {
          setCurrentView((prev) => (prev === 'AUTH' ? 'DASHBOARD' : prev));
        }
      } else {
        setSession(null);
        setCurrentView('AUTH');
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (userSession: UserSession) => {
    setSession(userSession);
    setCurrentView('DASHBOARD');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    }
    setSession(null);
    setCurrentView('AUTH');
  };

  const handleCreateRoom = () => {
    const newOtp = generateRoomOTP();
    setRoom((prev) => ({
      ...prev,
      id: newOtp,
      createdAt: Date.now(),
    }));
    setCurrentView('ROOM');
  };

  const handleJoinRoom = (otpCode: string) => {
    setRoom((prev) => ({
      ...prev,
      id: otpCode.toUpperCase(),
    }));
    setCurrentView('ROOM');
  };

  const handleAddBundleItem = (item: BundleItem) => {
    setRoom((prev) => ({
      ...prev,
      bundleItems: [item, ...prev.bundleItems],
    }));
  };

  const handleDownloadFile = (file: BundleItem) => {
    if (!file.blobUrl) return;
    const a = document.createElement('a');
    a.href = file.blobUrl;
    a.download = file.name;
    a.click();
  };

  const handleWipeSession = () => {
    if (window.confirm('Clear all ephemeral RAM cache files?')) {
      setRoom((prev) => ({
        ...prev,
        bundleItems: [],
      }));
    }
  };

  if (authChecking) {
    return (
      <div className="mesh-bg min-h-screen bg-[#131313] text-white flex flex-col items-center justify-center p-6 font-mono">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-xs text-blue-400 tracking-widest font-bold uppercase">
          VERIFYING_FIREBASE_SESSION...
        </div>
      </div>
    );
  }

  // Guard: If unauthenticated, render HeroSection or AuthScreen
  if (!session) {
    if (showAuthScreen) {
      return (
        <div className="bg-[#131313] text-[#e5e2e1] min-h-screen font-sans selection:bg-blue-500 selection:text-white relative overflow-x-hidden">
          <div className="absolute top-4 left-4 z-50">
            <button
              onClick={() => setShowAuthScreen(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-mono text-xs cursor-pointer backdrop-blur-md border border-white/20 transition-all"
            >
              ← BACK TO HERO
            </button>
          </div>
          <Navbar
            currentView="AUTH"
            setView={setCurrentView}
            session={null}
            onLogout={handleLogout}
            latencyMs={latencyMs}
          />
          <AuthScreen onLogin={handleLogin} />
        </div>
      );
    }

    return (
      <HeroSection
        onSignIn={() => setShowAuthScreen(true)}
        onStartForFree={() => {
          // Automatic quick guest login
          handleLogin({
            id: 'guest_vault_user',
            email: 'guest@ironclad.vault',
            identifier: 'guest@ironclad.vault',
            authenticated: true,
            nodeType: 'IRONCLAD_VAULT_0.1',
            encryptionAlgorithm: 'AES-256-GCM',
          });
        }}
      />
    );
  }

  return (
    <div className="bg-[#131313] text-[#e5e2e1] min-h-screen font-sans selection:bg-blue-500 selection:text-white relative overflow-x-hidden">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        setView={setCurrentView}
        session={session}
        onLogout={handleLogout}
        latencyMs={latencyMs}
      />

      {/* Main Screen Views */}
      {currentView === 'AUTH' && <AuthScreen onLogin={handleLogin} />}

      {currentView === 'DASHBOARD' && (
        <DashboardScreen
          session={session}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          setView={setCurrentView}
        />
      )}

      {currentView === 'ROOM' && (
        <RoomView
          room={room}
          onLeaveRoom={() => setCurrentView('DASHBOARD')}
          onPreviewFile={(file) => setPreviewFile(file)}
          onAddBundleItem={handleAddBundleItem}
        />
      )}

      {currentView === 'NETWORK' && <NetworkTopologyScreen room={room} />}

      {currentView === 'HISTORY' && (
        <HistoryScreen
          bundleItems={room.bundleItems}
          onWipeSession={handleWipeSession}
        />
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownloadFile}
        />
      )}
    </div>
  );
}
