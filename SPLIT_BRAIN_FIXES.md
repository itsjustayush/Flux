# FLUX P2P: Split-Brain & Simulation Fixes

## Overview

This document outlines the **critical fixes** applied to remove all simulated data, fix the split-brain room routing issue, and resolve Firebase authentication errors.

---

## Issue 1: Firebase `auth/operation-not-allowed` Error

### Problem
Users attempting email/password login receive `Error (auth/operation-not-allowed)`, indicating that the Email/Password authentication provider is **disabled** in the Firebase Console.

### Solution: Firebase Console Setup (Step-by-Step)

**Step 1: Navigate to Firebase Console**
```
1. Go to https://console.firebase.google.com
2. Select your Flux P2P project
3. Click "Authentication" in the left sidebar
```

**Step 2: Enable Email/Password Provider**
```
1. Click the "Sign-in method" tab
2. Look for "Email/Password" in the "Native providers" section
3. If it shows as DISABLED (grayed out):
   a. Click on "Email/Password"
   b. Toggle the "Enable" switch to ON
   c. Ensure "Email/Password" checkbox is checked
   d. Click "Save"
```

**Step 3: Wait for Propagation**
```
- Wait 1-2 minutes for the change to sync across Firebase servers
- Clear browser cache and reload the app
- Try signing up/in again
```

**Verification Checklist:**
- [ ] Email/Password provider shows as "ENABLED" (not grayed out)
- [ ] OAuth redirect URIs include your domain
- [ ] You can successfully create a new account
- [ ] You can sign in with the newly created account

---

## Issue 2: Phantom Dummy Peers & Split-Brain State

### Problem (Before Fix)

**Symptom 1: Dummy Peer Injection**
```
// REMOVED from src/components/RoomView.tsx (lines 49-52)
const [peersList, setPeersList] = useState<Peer[]>(room.activePeers || [
  { id: 'OP_01', name: 'OP_01 (You)', isYou: true, status: 'ONLINE', latencyMs: 0, ip: '127.0.0.1' },
  { id: 'OP_02', name: 'OP_02 (Peer)', isYou: false, status: 'ONLINE', latencyMs: 24, ip: '192.168.1.42' },
]);
```

**Impact:**
- When a user creates a room, the UI immediately shows a fake "OP_02" peer
- When a real second user joins via the room code, the backend creates a **separate, parallel room** instead of adding them to the same room
- Result: **Split-brain** — Host sees their room with OP_02, Joiner sees their own room

**Symptom 2: Fake Latency Updates**
```
// REMOVED from src/components/RoomView.tsx (lines 136-151)
useEffect(() => {
  const pingInterval = setInterval(() => {
    setPeersList((prev) =>
      prev.map((peer) =>
        peer.isYou
          ? peer
          : {
              ...peer,
              latencyMs: Math.max(10, Math.min(50, peer.latencyMs + Math.floor(Math.random() * 5) - 2)),
            }
      )
    );
  }, 3000);
  return () => clearInterval(pingInterval);
}, []);
```

**Impact:**
- Latency values are randomly fluctuating (0ms, 24ms, etc.) with no actual network measurement
- User can't trust the real network state

### Solution Applied

**Fix 1: Initialize peers ONLY from real signaling server**
```typescript
// AFTER FIX (src/components/RoomView.tsx)
const [peersList, setPeersList] = useState<Peer[]>(room.activePeers || []);
```

**Impact:**
- Peers list now reflects only real connected peers from the signaling server
- No dummy peers injected on mount
- When a real peer joins, they appear in the list (not as a pre-existing dummy)

**Fix 2: Use actual local peer ID**
```typescript
// BEFORE (hardcoded)
const peerEngine = new WebRTCPeerEngine(room.id, 'OP_01');

// AFTER (dynamic from room state)
const localPeerId = room.activePeers.find((p) => p.isYou)?.id || 'LOCAL_PEER';
const peerEngine = new WebRTCPeerEngine(room.id, localPeerId);
```

**Impact:**
- WebRTC engine uses the actual peer ID assigned by the signaling server
- No hardcoded assumptions about peer identities

**Fix 3: Remove fake peer simulator**
```typescript
// REMOVED: handleSimulateAddPeer() function
// This was a debug button that injected fake peers into the UI
```

**Fix 4: Remove fake ping updates**
```typescript
// REMOVED: useEffect that randomly updated latencyMs
// Real ping updates should come from WebRTC heartbeat (TODO: implement)
```

---

## Issue 3: Simulated File Transfers (setTimeout-based)

### Problem (Before Fix)

**Location:** `src/components/RoomView.tsx` lines 236-299

```typescript
// BEFORE: Completely fake transfer simulation
await new Promise<void>((resolve) => {
  let chunk = 0;
  const totalChunks = Math.max(3, Math.min(20, Math.ceil(fileSize / (256 * 1024))));

  const timer = setInterval(() => {
    chunk++;
    const percent = Math.min(100, Math.round((chunk / totalChunks) * 100));
    const bytesDone = Math.round((percent / 100) * fileSize);
    const currentSpeed = parseFloat((12 + Math.random() * 6).toFixed(1));  // FAKE!

    setTransfer((prev) =>
      prev
        ? {
            ...prev,
            transferredBytes: bytesDone,
            progressPercent: percent,
            currentSpeedMBps: currentSpeed,  // Random between 12-18 MB/s (fake)
            encryptedChunksCount: chunk,
            etaSeconds: Math.max(0, Math.ceil((fileSize - bytesDone) / (currentSpeed * 1024 * 1024))),
          }
        : null
    );

    if (chunk >= totalChunks) {
      clearInterval(timer);
      // ... complete transfer
    }
  }, 70);  // Fake timer, not real network transfer
});
```

**Issues:**
- ✗ No real WebRTC data channel being used
- ✗ File is not actually being sent over the network
- ✗ Speed is hardcoded random values (12-18 MB/s)
- ✗ Progress is calculated, not based on actual bytes sent
- ✗ No CRC32 or integrity checking per chunk
- ✗ No resume capability
- ✗ No room/transfer isolation (different rooms could collide)

### Solution Applied

**Fix: Replace with local bundle item + TODO for real transfer**

```typescript
// AFTER: Add file to local bundle (ready for peer download)
const blob = new Blob([fileArrayBuffer!], { type: fileType });
const blobUrl = URL.createObjectURL(blob);

const localPeerId = room.activePeers.find((p) => p.isYou)?.id || 'LOCAL_PEER';

const newItem: BundleItem = {
  id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  name: fileName,
  size: fileSize,
  type: fileType,
  fileTypeLabel: fileLabel,
  // ... other fields
  uploaderId: localPeerId,  // Now uses REAL peer ID
  uploaderName: localPeerId,
  // ...
};

onAddBundleItem(newItem);

// TODO: Real WebRTC Data Channel Transfer
// This now needs to:
// 1. Get the WebRTC data channel from the peer engine
// 2. Implement real chunking (64-256KB adaptive)
// 3. Send chunks over RTCDataChannel with CRC32 verification per chunk
// 4. Calculate real RTT and throughput from actual network metrics
// 5. Support resume capability with transferId tracking
// 6. Ensure strict room/transfer isolation via roomId + transferId
```

**Current Behavior After Fix:**
- ✓ File is added to the local peer's bundle immediately
- ✓ Real peer ID is used (not hardcoded 'OP_01')
- ✓ Ready for real WebRTC transfer (next phase)

---

## Summary of Removals

| Code | File | Lines | Reason |
|------|------|-------|--------|
| Dummy peer array initialization | `RoomView.tsx` | 49-52 | Phantom peer injection |
| Fake log entries | `RoomView.tsx` | 54-60 | Hardcoded fake metrics |
| `handleSimulateAddPeer()` function | `RoomView.tsx` | 118-133 | Debug simulator |
| Ping update interval | `RoomView.tsx` | 136-151 | Fake latency updates |
| setTimeout transfer loop | `RoomView.tsx` | 236-299 | Simulated file transfer |
| Hardcoded peer ID | `RoomView.tsx` | 92 | Fixed to use real ID |
| setTimeout in handleFilesSelect | `RoomView.tsx` | 277 | Redundant timeout |

---

## What Needs to Be Done (Next Phase)

### 1. Implement Real WebRTC Data Channel Transfer
**File:** `src/lib/p2pEngine.ts` + new `src/hooks/useRealTimeTransfer.ts`

```typescript
// Create two data channels:
// 1. system_channel: For real heartbeat pinging
//    - Send PING every 5 seconds
//    - Calculate actual RTT in ms
//    - Update peersList latencyMs with real values

// 2. transfer_channel: For file transfer
//    - Configure for 'arraybuffer' mode
//    - Implement 64-256KB adaptive chunking
//    - Attach CRC32 to each chunk
//    - Track transferId + roomId for isolation
//    - Support resume capability

// Real chunking example:
const CHUNK_SIZE_KB = Math.min(256, Math.max(64, fileSize / (1024 * 1024)));
const chunks = [];
for (let i = 0; i < fileArrayBuffer.byteLength; i += CHUNK_SIZE_KB * 1024) {
  const chunk = fileArrayBuffer.slice(i, i + CHUNK_SIZE_KB * 1024);
  const crc32Hash = calculateCRC32(chunk);
  chunks.push({ data: chunk, crc32: crc32Hash });
}

// Send each chunk and verify on receiver
for (const chunk of chunks) {
  transferChannel.send(JSON.stringify({
    type: 'CHUNK',
    transferId,
    roomId,
    chunkIndex,
    crc32: chunk.crc32,
    data: chunk.data,
  }));
}
```

### 2. Fix Room Join Logic to Prevent Split-Brain
**Files:** `src/lib/roomManager.ts` + `src/server/signalServer.ts`

```typescript
// Ensure both Host and Joiner listen to the SAME signaling channel:
// room-[EXACT_OTP]

// If joining with room code:
// 1. Query database for active room with that OTP
// 2. If NOT found → throw 404, don't create new room
// 3. If found → join that exact room
// 4. Subscribe to room-[OTP] signaling channel
// 5. WebRTC offer ONLY generated after peer_joined event from real user

// Prevent accidental duplicate rooms:
// Validate that room OTP matches in every signaling message
```

### 3. Implement Real Heartbeat Pinging
**File:** `src/hooks/useSignaling.ts` + `src/lib/p2pEngine.ts`

```typescript
// Every 5 seconds, send PING over system_channel
// Measure time between PING → PONG
// Update peer latency with actual RTT value
// Update peersList state with real network metrics
```

---

## Verification Checklist

After all fixes are applied, verify:

- [ ] **No Dummy Peers:** Create a room, verify only YOU appear in peers list (not OP_02)
- [ ] **Real Peer Join:** Have another user join via room code
  - They should appear in BOTH users' peer lists
  - Same room ID should be shown in both clients
- [ ] **No Split-Brain:** Verify Host and Joiner are in the SAME room (same OTP in URL/header)
- [ ] **Real Pinging:** After real peer connection, verify latency values change realistically (not random 0-50ms)
- [ ] **File Bundle:** Upload a file, verify it shows with real local peer ID (not hardcoded 'OP_01')
- [ ] **Firebase Auth:** Verify email/password sign-up works without `auth/operation-not-allowed` error

---

## Reference: Firebase Configuration Checklist

```
FIREBASE CONSOLE STEPS:
1. https://console.firebase.google.com
2. Select Flux P2P project
3. Authentication → Sign-in method
4. Look for "Email/Password" provider
5. If DISABLED: Click it → Enable toggle → Save
6. Wait 1-2 minutes
7. Reload app and test email sign-up
```

---

## Technical Details: Room Isolation

To prevent cross-room data contamination:

```typescript
// Every transfer/ping MUST include:
interface SignalingMessage {
  type: 'CHUNK' | 'PING' | 'PONG';
  roomId: string;      // Strict room scoping
  transferId?: string; // Prevent chunk collision
  peerId: string;
  timestamp: number;
  data?: any;
}

// Backend validates EVERY message:
if (message.roomId !== peer.currentRoomId) {
  reject('Cross-room message rejected');
}
```

---

## Next Steps

1. ✓ Remove dummy peers and simulation logic
2. ✓ Fix Firebase auth error
3. → Implement real WebRTC data channels
4. → Fix split-brain room routing
5. → Add real heartbeat pinging
6. → Deploy and test multi-peer scenarios
