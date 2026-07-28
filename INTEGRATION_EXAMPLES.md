# FLUX_P2P Integration Examples

Quick-start examples for integrating each module into your application.

## 1. Starting the Signaling Server

```typescript
// src/server/index.ts
import { getSignalingServer } from './signalServer';

// Start on port 3001
const server = getSignalingServer(3001);

// Or start in Express app
import express from 'express';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);
const wsServer = getSignalingServer();

httpServer.listen(3001, () => {
  console.log('Signaling server running on port 3001');
});
```

## 2. Creating a Peer Connection Component

```typescript
// src/components/PeerConnection.tsx
import React, { useEffect, useState } from 'react';
import { useSignaling } from '../hooks/useSignaling';
import { WebRTCPeerEngine } from '../lib/p2pEngine';
import { getRoomManager } from '../lib/roomManager';
import { getIceServerManager } from '../lib/iceServerManager';

export function PeerConnection({ roomId, peerId }: { roomId: string; peerId: string }) {
  const [peers, setPeers] = useState<string[]>([]);
  const peerEngineRef = React.useRef<WebRTCPeerEngine | null>(null);
  const roomRef = React.useRef(getRoomManager(roomId));

  const { connected, sendOffer, sendAnswer, sendCandidate, error } = useSignaling({
    signalingUrl: 'ws://localhost:3001',
    roomId,
    peerId,
    onRoomState: (data) => {
      // Handle room state updates
      if (data.event === 'peer_joined') {
        setPeers((prev) => [...prev, data.peerId]);
      } else if (data.event === 'peer_left') {
        setPeers((prev) => prev.filter((id) => id !== data.peerId));
      }
    },
    onSignal: (message) => {
      // Handle signaling messages
      if (message.type === 'offer') {
        handleOffer(message.peerId, message.data);
      } else if (message.type === 'answer') {
        handleAnswer(message.peerId, message.data);
      } else if (message.type === 'candidate') {
        handleCandidate(message.peerId, message.data);
      }
    },
  });

  // Initialize WebRTC peer engine
  useEffect(() => {
    const room = roomRef.current;
    
    if (!peerEngineRef.current) {
      const iceManager = getIceServerManager();
      const iceConfig = iceManager.getConfiguration();
      
      peerEngineRef.current = new WebRTCPeerEngine(roomId, peerId);
      peerEngineRef.current.onSignalOutput = (signal) => {
        if (signal.type === 'offer') {
          sendOffer(peers[0], signal.data);
        } else if (signal.type === 'candidate') {
          sendCandidate(peers[0], signal.data);
        }
      };

      room.addPeer(peerId);
    }

    return () => {
      peerEngineRef.current?.close();
      room.removePeer(peerId);
    };
  }, [roomId, peerId, sendOffer, sendCandidate, peers]);

  const handleOffer = async (fromPeerId: string, offerData: RTCSessionDescriptionInit) => {
    try {
      const engine = peerEngineRef.current;
      if (!engine) return;

      const answer = await engine.handleOffer(offerData);
      if (answer) {
        sendAnswer(fromPeerId, answer);
        const room = roomRef.current;
        room.setPeerState(fromPeerId, 'connected');
      }
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (fromPeerId: string, answerData: RTCSessionDescriptionInit) => {
    try {
      const engine = peerEngineRef.current;
      if (!engine) return;

      await engine.handleAnswer(answerData);
      const room = roomRef.current;
      room.setPeerState(fromPeerId, 'connected');
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleCandidate = async (fromPeerId: string, candidateData: RTCIceCandidateInit) => {
    try {
      const engine = peerEngineRef.current;
      if (!engine) return;

      await engine.addIceCandidate(candidateData);
    } catch (err) {
      console.error('Error adding candidate:', err);
    }
  };

  return (
    <div>
      <div>
        <strong>Room:</strong> {roomId}
      </div>
      <div>
        <strong>Peer ID:</strong> {peerId}
      </div>
      <div>
        <strong>Connected:</strong> {connected ? '✓' : '✗'}
      </div>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      <div>
        <strong>Peers in room:</strong>
        <ul>
          {peers.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

## 3. File Transfer Component

```typescript
// src/components/FileTransfer.tsx
import React, { useRef, useState } from 'react';
import { getFileTransferEngine } from '../lib/fileTransferEngine';
import { getMetricsCollector } from '../lib/metricsCollector';

export function FileTransfer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transferProgress, setTransferProgress] = useState<Record<string, number>>({});
  const engineRef = React.useRef(getFileTransferEngine());

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const engine = engineRef.current;
    const metadata = engine.initiateTransfer(file);
    const collector = getMetricsCollector();

    // Monitor progress
    engine.onProgress(metadata.fileId, (progress) => {
      setTransferProgress((prev) => ({
        ...prev,
        [metadata.fileId]: (progress.bytesTransferred / progress.totalBytes) * 100,
      }));

      console.log(`Transfer: ${progress.bytesTransferred}/${progress.totalBytes} bytes`);
    });

    // Generate and send chunks
    const startTime = Date.now();
    let chunkCount = 0;

    for await (const chunk of engine.generateChunks(file)) {
      // Send chunk to peer via DataChannel
      await sendChunkToPeer(chunk);
      chunkCount++;
    }

    // Record metrics
    const duration = Date.now() - startTime;
    const throughput = file.size / (duration / 1000);

    collector.recordTransferMetrics({
      fileSize: file.size,
      transferDuration: duration,
      throughput,
      chunkCount,
      retransmissions: 0,
      checksumMismatches: 0,
      success: engine.isComplete(metadata.fileId),
    });

    engine.cleanup(metadata.fileId);
  };

  const sendChunkToPeer = async (chunk: any) => {
    // This would send via DataChannel
    console.log(`Sending chunk ${chunk.chunkIndex}/${chunk.fileId}`);
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" onChange={handleFileSelect} />
      <div>
        {Object.entries(transferProgress).map(([fileId, progress]) => (
          <div key={fileId}>
            <div>{Math.round(progress)}%</div>
            <div style={{ width: '200px', height: '10px', backgroundColor: '#eee' }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#0066cc',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function sendChunkToPeer(chunk: any) {
  // Implementation
}
```

## 4. Room Management

```typescript
// src/hooks/useRoom.ts
import { useEffect, useState } from 'react';
import { getRoomManager, RoomState } from '../lib/roomManager';

export function useRoom(roomId: string) {
  const [roomState, setRoomState] = useState<RoomState>('created');
  const [peerCount, setPeerCount] = useState(0);
  const roomRef = React.useRef(getRoomManager(roomId));

  useEffect(() => {
    const room = roomRef.current;

    const unsubscribe = room.onStateChange((newState) => {
      setRoomState(newState);
    });

    return unsubscribe;
  }, [roomId]);

  useEffect(() => {
    const room = roomRef.current;
    const interval = setInterval(() => {
      setPeerCount(room.getPeers().length);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    roomState,
    peerCount,
    addPeer: (peerId: string) => roomRef.current.addPeer(peerId),
    removePeer: (peerId: string) => roomRef.current.removePeer(peerId),
  };
}
```

## 5. Error Handling with Retry

```typescript
// src/utils/retryWithBackoff.ts
import { ErrorHandler, Validators, ValidationException } from '../lib/validators';

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  errorCode?: string
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const categorized = ErrorHandler.categorizeError(error);
      const shouldRetry = ErrorHandler.shouldRetry(
        errorCode || categorized.code,
        attempt
      );

      if (!shouldRetry) {
        throw error;
      }

      const delay = ErrorHandler.getBackoffDelay(attempt);
      console.log(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${categorized.message}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const result = await retryWithBackoff(async () => {
  return await connectToPeer(peerId);
}, 5, 'ERR_ICE_FAILED');
```

## 6. Monitoring Dashboard

```typescript
// src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { getMetricsCollector } from '../lib/metricsCollector';
import { getIceServerManager } from '../lib/iceServerManager';

export function Dashboard() {
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const collector = getMetricsCollector();
      setHealth(collector.getHealthStatus());

      const connTimeMetric = collector.getAggregates('connection_time', 60000);
      setMetrics(connTimeMetric);

      const iceManager = getIceServerManager();
      const iceMetrics = iceManager.getMetrics();
      console.log('ICE Server Metrics:', iceMetrics);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>System Health</h2>
      {health && (
        <div>
          <div>Healthy: {health.healthy ? '✓' : '✗'}</div>
          <div>Error Count: {health.errorCount}</div>
          <div>Critical Errors: {health.criticalErrors}</div>
          <div>Avg Latency: {health.avgLatency.toFixed(2)}ms</div>
        </div>
      )}

      <h2>Connection Metrics</h2>
      {metrics && (
        <div>
          <div>Count: {metrics.count}</div>
          <div>Min: {metrics.min.toFixed(2)}ms</div>
          <div>Max: {metrics.max.toFixed(2)}ms</div>
          <div>Avg: {metrics.avg.toFixed(2)}ms</div>
          <div>P95: {metrics.p95.toFixed(2)}ms</div>
          <div>P99: {metrics.p99.toFixed(2)}ms</div>
        </div>
      )}
    </div>
  );
}
```

## 7. Input Validation

```typescript
// src/utils/validateInputs.ts
import { Validators, ValidationException } from '../lib/validators';

export function validateRoomSetup(roomId: string, peerId: string) {
  const roomResult = Validators.roomId(roomId);
  if (!roomResult.valid) {
    throw new Error(`Invalid room ID: ${roomResult.errors[0].message}`);
  }

  const peerResult = Validators.peerId(peerId);
  if (!peerResult.valid) {
    throw new Error(`Invalid peer ID: ${peerResult.errors[0].message}`);
  }

  return { roomId: roomResult.data!, peerId: peerResult.data! };
}

export function validateFileTransfer(file: File) {
  const result = Validators.fileMetadata(file.name, file.size, file.type);
  
  // Errors can include both critical (valid=false) and warnings
  result.errors.forEach(error => {
    if (error.severity === 'error') {
      throw new Error(error.message);
    } else if (error.severity === 'warning') {
      console.warn(error.message);
    }
  });

  return result.data;
}
```

## 8. Environment Configuration

```typescript
// .env
VITE_SIGNALING_SERVER=ws://localhost:3001
VITE_MAX_FILE_SIZE=524288000  # 500MB
VITE_CHUNK_SIZE=65536  # 64KB
VITE_ROOM_IDLE_TIMEOUT=300000  # 5 minutes
VITE_ENABLE_METRICS=true
```

```typescript
// src/config.ts
export const config = {
  signalingServer: import.meta.env.VITE_SIGNALING_SERVER || 'ws://localhost:3001',
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '524288000'),
  chunkSize: parseInt(import.meta.env.VITE_CHUNK_SIZE || '65536'),
  roomIdleTimeout: parseInt(import.meta.env.VITE_ROOM_IDLE_TIMEOUT || '300000'),
  enableMetrics: import.meta.env.VITE_ENABLE_METRICS === 'true',
};
```

## Running the System

```bash
# Terminal 1: Start signaling server
npm run dev  # Vite dev server with Express middleware

# Terminal 2: Open multiple browser windows
# Each browser tab can join same room with different peerId
# Room auto-discovered via signaling server

# Monitor metrics
curl http://localhost:3001/stats

# Check server health
curl http://localhost:3001/health
```

These examples provide a complete end-to-end integration of all FLUX_P2P modules.
