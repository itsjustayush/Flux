# FLUX_P2P — Ironclad Vault

A zero-knowledge, ephemeral P2P file-sharing web app built with React, Vite, TypeScript, Tailwind CSS v4, and Firebase Auth.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Auth**: Firebase Authentication (email/password + Google Sign-In)
- **Database**: Firestore (Firebase) — `firebase-applet-config.json` holds the config
- **P2P / Encryption**: WebRTC (`RTCPeerConnection`) + Web Crypto API (AES-256-GCM)
- **Animation**: Framer Motion
- **QR Codes**: `qrcode.react`

## How to run

```
npm run dev
```

Starts the Vite dev server on **port 5000** (`http://localhost:5000`).

## Project structure

```
src/
  App.tsx                  # Root: routing, auth state, room state
  types.ts                 # Core TypeScript interfaces
  index.css                # Global styles + CSS variables + Tailwind
  main.tsx                 # React entry point
  components/
    HeroSection.tsx        # Landing page (unauthenticated)
    AuthScreen.tsx         # Firebase login / sign-up form
    Navbar.tsx             # Top navigation bar
    DashboardScreen.tsx    # Create room / join room by OTP
    RoomView.tsx           # Active P2P room: file drop zone, bundle tray
    NetworkTopologyScreen.tsx  # Live peer mesh graph
    HistoryScreen.tsx      # Session transfer history
    QRCodeModal.tsx        # QR codes for mobile join / bundle download
    FilePreviewModal.tsx   # File preview with metadata sidebar
  lib/
    firebase.ts            # Firebase app init + auth exports
    p2pEngine.ts           # WebRTCPeerEngine class, OTP generator, validators
    crypto.ts              # AES-256-GCM encrypt, formatBytes, carbon metrics
  data/
    defaultFiles.ts        # Default bundle items (currently empty)
```

## Authentication

Authentication is **required**. Users must sign in (email/password or Google) before accessing the dashboard or any file-sharing features. The `HeroSection` landing page is the only unauthenticated view.

## Room OTP format

Room codes are 6 alphanumeric characters stored internally (e.g., `XR92KB`), displayed with dashes for readability (`XR-92-KB`). Generated via `generateRoomOTP()` in `src/lib/p2pEngine.ts`.

## Environment secrets

- `SESSION_SECRET` — used for session signing (configured in Replit Secrets)
- `GEMINI_API_KEY` — required if using Gemini AI features (see `.env.example`)

## User preferences

- Keep the existing project structure; don't migrate or restructure
- Tailwind CSS v4 is used (not v3); use `@tailwindcss/vite` plugin pattern
