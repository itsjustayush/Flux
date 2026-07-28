# Architecture Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUX P2P Application                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌──────────────┐ ┌──────────┐ ┌──────────────┐
        │  Auth Flow   │ │ File UI  │ │ Room Manager │
        │ (Firebase)   │ │ (React)  │ │  (State)     │
        └──────┬───────┘ └────┬─────┘ └──────┬───────┘
               │              │              │
        ┌──────▼──────────────▼──────────────▼──────┐
        │    Component Layer (AuthScreen, RoomView) │
        └──────┬──────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────┐
        │         Hook Layer                      │
        │  - useRealTimeTransfer()               │
        │  - useSignaling()                      │
        │  - Custom React hooks                  │
        └──────┬──────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────┐
        │     Library Layer (Business Logic)      │
        │  ┌────────────────────────────────────┐│
        │  │ Authentication Layer               ││
        │  │  - signInWithEmail()               ││
        │  │  - signUpWithEmail()               ││
        │  │  - Error handling & categorization ││
        │  └────────────────────────────────────┘│
        │  ┌────────────────────────────────────┐│
        │  │ Real-Time Transfer Engine          ││
        │  │  - RealTimeTransferManager         ││
        │  │  - Chunking & CRC32                ││
        │  │  - Room isolation                  ││
        │  │  - RTT pinging                     ││
        │  └────────────────────────────────────┘│
        │  ┌────────────────────────────────────┐│
        │  │ WebRTC Peer Engine                 ││
        │  │  - RTCPeerConnection               ││
        │  │  - RTCDataChannel (binary)         ││
        │  │  - ICE server management           ││
        │  └────────────────────────────────────┘│
        └──────┬──────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────┐
        │     Network Layer (WebRTC)              │
        │  ┌────────────────────────────────────┐│
        │  │ RTCDataChannel (Ordered, Binary)   ││
        │  │  - transfer_channel (file data)    ││
        │  │  - system_channel (signals/ping)   ││
        │  └────────────────────────────────────┘│
        │  ┌────────────────────────────────────┐│
        │  │ RTCPeerConnection                  ││
        │  │  - Signaling server (WebSocket)    ││
        │  │  - ICE candidates                  ││
        │  │  - Offer/Answer negotiation        ││
        │  └────────────────────────────────────┘│
        └──────┬──────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────┐
        │     External Services                  │
        │  - Firebase Authentication             │
        │  - Signaling Server (WebSocket)        │
        │  - STUN/TURN servers (ICE)             │
        └──────────────────────────────────────┘
```

---

## Authentication Flow

```
┌─────────────────────────────────────┐
│     User enters email/password      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   AuthScreen component              │
│   (src/components/AuthScreen.tsx)   │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   ┌────────┐    ┌────────┐
   │ Sign   │    │ Sign   │
   │ Up     │    │ In     │
   └───┬────┘    └───┬────┘
       │             │
       └──────┬──────┘
              │
              ▼
┌──────────────────────────────────────────┐
│ src/lib/auth.ts                          │
│ - Input validation                       │
│ - Firebase call                          │
│ - Error extraction & mapping             │
└──────────┬───────────────────────────────┘
           │
    ┌──────┴─────────────┬──────────────┐
    │                    │              │
    ▼                    ▼              ▼
SUCCESS            USER ERROR        FIREBASE ERROR
    │                    │              │
    │          - Wrong password    - Operation not allowed
    │          - User not found     - Weak password
    │          - Email in use       - Too many requests
    │          - Weak password      - Network error
    │                    │              │
    └────────┬───────────┴──────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ User-Friendly Error Message              │
│ (Never raw Firebase error!)              │
│                                          │
│ "[ERR_AUTH] Email login is currently    │
│  disabled by the administrator."         │
│                                          │
│ OR on success:                           │
│ → Create UserSession & redirect to room  │
└──────────────────────────────────────────┘
```

---

## Real-Time File Transfer Flow

```
┌─────────────────────────────────────────────┐
│  User selects file                          │
│  (File selection UI in RoomView)            │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│ useRealTimeTransfer hook         │
│ (src/hooks/useRealTimeTransfer) │
└────────────┬─────────────────────┘
             │
             ▼
┌───────────────────────────────────────────┐
│ sendFile(file)                            │
│ 1. Initialize transfer with metadata      │
│ 2. Create transferId & room context       │
└────────┬────────────────────────────────┬─┘
         │                                │
         ▼                                ▼
┌──────────────────────┐    ┌──────────────────────┐
│ RealTimeTransfer     │    │ FileReader API       │
│ Manager              │    │ Read file in chunks  │
│ - Initialize         │    │ (64-256KB each)      │
│ - Adaptive chunking  │    │                      │
│ - Track state        │    │ Yield to event loop  │
└──────┬───────────────┘    └──────┬───────────────┘
       │                           │
       └───────────┬───────────────┘
                   │
         ┌─────────▼─────────┐
         │ For each chunk:   │
         │                   │
         │ 1. Calculate      │
         │    CRC32          │
         │ 2. Send metadata  │
         │ 3. Send binary    │
         │    data           │
         │                   │
         └────────┬──────────┘
                  │
                  ▼
         ┌──────────────────────┐
         │ WebRTC DataChannel   │
         │ (Binary, Ordered)    │
         │                      │
         │ Real data (bytes),   │
         │ not simulation       │
         └────────┬─────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │ Network                      │
    │ (P2P between peers)          │
    └──────────┬──────────────────┘
               │
               ▼
    ┌─────────────────────────────┐
    │ Receiver:                   │
    │ DataChannel.onmessage       │
    │                             │
    │ 1. Receive chunk            │
    │ 2. Verify CRC32             │
    │ 3. Store in isolated buffer │
    │ 4. Update progress          │
    └────────┬────────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ All chunks received?       │
    │ YES → Assemble Blob        │
    │ NO → Wait for more chunks  │
    └──────────┬─────────────────┘
               │
               ▼
    ┌────────────────────────────┐
    │ Assemble into Blob         │
    │ - Concatenate chunks       │
    │ - Verify total size        │
    │ - Create ObjectURL         │
    │ - Cleanup transfer state   │
    └──────────┬─────────────────┘
               │
               ▼
    ┌────────────────────────────┐
    │ onComplete callback        │
    │ - Download file or         │
    │ - Display file preview     │
    │ - Update UI                │
    └────────────────────────────┘
```

---

## Concurrent Transfer Isolation

```
┌─────────────────────────────────────────┐
│  Room A              Room B              │
│  (Peer 1 ↔ Peer 2)   (Peer 3 ↔ Peer 4) │
└────────────┬─────────────────────────────┘
             │
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
┌──────────────────┐ ┌──────────────────┐
│ Transfer A1      │ │ Transfer B1      │
│ video.mp4        │ │ document.pdf     │
│ 500 MB           │ │ 5 MB             │
│                  │ │                  │
│ RealTimeTransfer │ │ RealTimeTransfer │
│ Manager:         │ │ Manager:         │
│ - transferId: A1 │ │ - transferId: B1 │
│ - roomId: A      │ │ - roomId: B      │
│ - chunks: []     │ │ - chunks: []     │
│ - state: {...}   │ │ - state: {...}   │
└──────┬───────────┘ └─────┬────────────┘
       │                   │
       │ (Isolated)        │ (Isolated)
       │ No mixing!        │ No mixing!
       │                   │
       └────────┬──────────┘
                │
        ┌───────▼────────┐
        │ activeTransfers│
        │ Map:           │
        │ A1 → {...}     │
        │ B1 → {...}     │
        │                │
        │ receivedChunks │
        │ Map:           │
        │ A1 → [buf1...] │
        │ B1 → [buf1...] │
        │                │
        │ Each isolated! │
        └────────────────┘

Key: Each transfer has its own:
- State tracking
- Chunk buffer
- Transfer metadata
- No shared resources
- Prevents corruption
```

---

## Room Isolation Security

```
┌────────────────────────────────────────┐
│ Transfer receives chunk                │
│ {transferId: 'A1', data: ArrayBuffer} │
└─────────────────┬──────────────────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ Verify transfer  │
         │ exists in map    │
         │ with correct     │
         │ roomId           │
         └────┬─────────────┘
              │
        ┌─────┴─────┐
        │           │
        ▼           ▼
   ✓ VALID    ✗ INVALID/NOT FOUND
   │           │
   │       Error logged:
   │       "Cross-room data
   │        bleed attempt"
   │
   ▼
Store chunk in
isolated buffer
for transfer A1

This ensures:
1. Chunk from Room B cannot
   access Room A's transfer
2. Chunk from different peer
   cannot corrupt current room
3. All data strictly scoped
4. No buffer overflow into
   other transfers
```

---

## Real vs Simulated: Side-by-Side

### Simulated (Before)
```javascript
❌ Timer-based progress
setInterval(() => {
  chunk++;
  const percent = Math.round((chunk / totalChunks) * 100);
  // FAKE speed
  const speed = 12 + Math.random() * 6; // 12-18 MB/s random
  setTransfer({ progressPercent: percent, currentSpeedMBps: speed });
}, 70);

❌ No actual data transfer
❌ No concurrency checks
❌ No integrity verification
❌ No real RTT measurement
❌ Simulated room isolation
```

### Real (After)
```typescript
✓ Actual bytes transferred
for await (const chunk of manager.readFileAsChunks(file, chunkSize)) {
  const actualBytes = chunk.byteLength;
  sentBytes += actualBytes;
  
  // REAL speed from actual data
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const realSpeed = sentBytes / 1024 / 1024 / elapsedSeconds;
  
  // Actual WebRTC data channel
  peerEngine.dataChannel.send(chunk);
}

✓ Real concurrent transfers
✓ CRC32 per-chunk verification
✓ Real RTT (5s heartbeat ping)
✓ Strict room isolation (verified)
✓ Resume from checkpoint
✓ 500MB+ support
```

---

## Error Handling Flow

```
┌──────────────────────────────────┐
│  Firebase throws error           │
│  AuthError { code: 'auth/...' }  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ extractErrorCode(error)          │
│ - Handle various error types     │
│ - Extract code safely            │
│ → Returns error code string      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ getErrorMessage(errorCode)       │
│ - Map code to user message       │
│ - Never expose raw Firebase      │
│ → Returns safe message string    │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ categorizeError(errorCode)       │
│ - Determine error type:          │
│   * user_input_error             │
│   * rate_limit                   │
│   * service_unavailable          │
│   * admin_required               │
│   * unknown                      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Return structured result:        │
│ {                                │
│   success: false,                │
│   errorCode: 'auth/...',         │
│   errorMessage: 'Safe message'   │
│ }                                │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Display to user:                 │
│ error banner with safe message   │
│ (Never expose errorCode)         │
└──────────────────────────────────┘
```

---

## Data Flow: File Transfer from Peer A to Peer B

```
PEER A (SENDER)                        PEER B (RECEIVER)
┌──────────────┐                       ┌──────────────┐
│ File Input   │                       │              │
└──────┬───────┘                       │              │
       │                               │              │
       ▼                               │              │
┌──────────────────────────────┐       │              │
│ useRealTimeTransfer.sendFile │       │              │
└──────┬───────────────────────┘       │              │
       │                               │              │
       ▼                               │              │
┌──────────────────────────────┐       │              │
│ manager.initializeTransfer   │       │              │
│ - transferId: ABC123         │       │              │
│ - roomId: ROOM1              │       │              │
│ - fileSize: 50MB             │       │              │
│ - chunkSize: 128KB           │       │              │
└──────┬───────────────────────┘       │              │
       │                               │              │
       ▼                               │              │
┌──────────────────────────────┐       │              │
│ FileReader.readAsArrayBuffer │       │              │
│ (Real file data)             │       │              │
└──────┬───────────────────────┘       │              │
       │                               │              │
       ▼                               │              │
┌──────────────────────────────┐       │              │
│ For each chunk (128KB):      │       │              │
│ 1. Calculate CRC32           │       │              │
│ 2. Send metadata             ├──────►│ Receive      │
│ 3. Send binary data          │       │ metadata     │
└──────┬───────────────────────┘       │              │
       │                               ▼              │
       │                        ┌──────────────────┐  │
       │                        │ Store chunk      │  │
       │                        │ in buffer[idx]   │  │
       │                        │ Verify CRC32     │  │
       │                        │ Update progress  │  │
       │                        └──────┬───────────┘  │
       │                               │              │
       │                               ▼              │
       │                        ┌──────────────────┐  │
       │                        │ All chunks?      │  │
       │                        │ NO: Wait         │  │
       │                        │ YES: Assemble    │  │
       │                        └──────┬───────────┘  │
       │                               │              │
       ▼                               ▼              │
┌──────────────────────────────┐ ┌──────────────────┐ │
│ Heartbeat RTT every 5s       │ │ onComplete:      │ │
│ PING ────────────────────────►│ • Create Blob    │ │
│      ◄──────────────── PONG   │ • ObjectURL      │ │
│ Real RTT: 24ms               │ • Download file  │ │
└──────────────────────────────┘ └──────────────────┘ │
                                         ▲            │
                                         │            │
                                         └────────────┘
Real data flow through WebRTC DataChannel
No simulation, no mocking, no fake progress
```

---

This architecture ensures:
- ✅ Strict room isolation (no cross-room data bleeding)
- ✅ Real concurrent transfers (multiple rooms simultaneously)
- ✅ Integrity verification (CRC32 per-chunk)
- ✅ Real network metrics (actual RTT, actual speed)
- ✅ Large file support (adaptive chunking, streaming)
- ✅ Production-ready error handling (user-friendly messages)
- ✅ Type-safe (full TypeScript support)
