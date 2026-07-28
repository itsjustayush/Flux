/**
 * WebSocket Signaling Server for WebRTC
 * Handles peer signaling, room management, and connection coordination
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export interface SignalMessage {
  type:
    | 'join'
    | 'offer'
    | 'answer'
    | 'candidate'
    | 'room_state'
    | 'error'
    | 'ping'
    | 'pong';
  roomId?: string;
  peerId?: string;
  targetPeerId?: string;
  data?: any;
  timestamp?: number;
}

export interface RoomState {
  roomId: string;
  peers: Map<string, WebSocket>;
  createdAt: number;
  lastActivity: number;
}

export class SignalingServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private rooms: Map<string, RoomState> = new Map();
  private peerToRoom: Map<WebSocket, { roomId: string; peerId: string }> =
    new Map();
  private inactivityTimeout = 5 * 60 * 1000; // 5 minutes
  private heartbeatInterval = 30 * 1000; // 30 seconds
  private heartbeatTimers: Map<WebSocket, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3001) {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupRoutes();
    this.setupWebSocket();
    this.startCleanupInterval();

    this.httpServer.listen(port, () => {
      console.log(`[SignalingServer] Listening on port ${port}`);
    });
  }

  private setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        rooms: this.rooms.size,
        timestamp: Date.now(),
      });
    });

    this.app.get('/stats', (req, res) => {
      const stats = {
        totalRooms: this.rooms.size,
        totalPeers: this.peerToRoom.size,
        rooms: Array.from(this.rooms.entries()).map(([roomId, room]) => ({
          roomId,
          peerCount: room.peers.size,
          createdAt: room.createdAt,
          lastActivity: room.lastActivity,
          uptime: Date.now() - room.createdAt,
        })),
      };
      res.json(stats);
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[SignalingServer] New WebSocket connection');

      ws.on('message', (data: Buffer) => {
        try {
          const message: SignalMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[SignalingServer] Error parsing message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('[SignalingServer] WebSocket error:', error);
      });

      this.startHeartbeat(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: SignalMessage) {
    switch (message.type) {
      case 'join':
        this.handleJoin(ws, message);
        break;
      case 'offer':
        this.relayMessage(ws, message);
        break;
      case 'answer':
        this.relayMessage(ws, message);
        break;
      case 'candidate':
        this.relayMessage(ws, message);
        break;
      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        console.warn(
          `[SignalingServer] Unknown message type: ${message.type}`
        );
    }
  }

  private handleJoin(ws: WebSocket, message: SignalMessage) {
    const { roomId, peerId } = message;

    if (!roomId || !peerId) {
      this.sendError(ws, 'Missing roomId or peerId');
      return;
    }

    // Get or create room
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        peers: new Map(),
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      this.rooms.set(roomId, room);
    }

    // Check if peer already exists
    if (room.peers.has(peerId)) {
      this.sendError(ws, `Peer ${peerId} already in room`);
      return;
    }

    // Add peer to room
    room.peers.set(peerId, ws);
    this.peerToRoom.set(ws, { roomId, peerId });
    room.lastActivity = Date.now();

    // Get list of existing peers
    const existingPeers = Array.from(room.peers.keys()).filter(
      (id) => id !== peerId
    );

    // Send room state to new peer
    this.sendMessage(ws, {
      type: 'room_state',
      data: {
        peerId,
        peers: existingPeers,
        roomSize: room.peers.size,
      },
      timestamp: Date.now(),
    });

    // Notify other peers of new peer
    this.broadcastToRoom(roomId, {
      type: 'room_state',
      data: {
        event: 'peer_joined',
        peerId,
        roomSize: room.peers.size,
      },
      timestamp: Date.now(),
    });

    console.log(
      `[SignalingServer] Peer ${peerId} joined room ${roomId} (total: ${room.peers.size})`
    );
  }

  private relayMessage(ws: WebSocket, message: SignalMessage) {
    const peerInfo = this.peerToRoom.get(ws);
    if (!peerInfo) {
      this.sendError(ws, 'Not in a room');
      return;
    }

    const { roomId, peerId } = peerInfo;
    const { targetPeerId } = message;

    if (!targetPeerId) {
      this.sendError(ws, 'Missing targetPeerId');
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendError(ws, 'Room not found');
      return;
    }

    const targetWs = room.peers.get(targetPeerId);
    if (!targetWs) {
      this.sendError(ws, `Target peer ${targetPeerId} not found`);
      return;
    }

    // Relay message to target peer
    this.sendMessage(targetWs, {
      type: message.type,
      peerId,
      data: message.data,
      timestamp: Date.now(),
    });

    room.lastActivity = Date.now();
  }

  private broadcastToRoom(
    roomId: string,
    message: SignalMessage,
    excludePeerId?: string
  ) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.peers.forEach((ws, peerId) => {
      if (excludePeerId && peerId === excludePeerId) return;
      this.sendMessage(ws, message);
    });
  }

  private sendMessage(ws: WebSocket, message: SignalMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      data: { message: error },
      timestamp: Date.now(),
    });
  }

  private handleDisconnect(ws: WebSocket) {
    const peerInfo = this.peerToRoom.get(ws);
    if (!peerInfo) return;

    const { roomId, peerId } = peerInfo;
    const room = this.rooms.get(roomId);

    if (room) {
      room.peers.delete(peerId);
      room.lastActivity = Date.now();

      // Notify other peers of disconnection
      this.broadcastToRoom(roomId, {
        type: 'room_state',
        data: {
          event: 'peer_left',
          peerId,
          roomSize: room.peers.size,
        },
        timestamp: Date.now(),
      });

      // Remove empty rooms
      if (room.peers.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[SignalingServer] Deleted empty room ${roomId}`);
      }

      console.log(
        `[SignalingServer] Peer ${peerId} left room ${roomId} (remaining: ${room.peers.size})`
      );
    }

    this.peerToRoom.delete(ws);
    this.stopHeartbeat(ws);
  }

  private startHeartbeat(ws: WebSocket) {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, { type: 'ping', timestamp: Date.now() });
      }
    }, this.heartbeatInterval);

    this.heartbeatTimers.set(ws, timer);
  }

  private stopHeartbeat(ws: WebSocket) {
    const timer = this.heartbeatTimers.get(ws);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(ws);
    }
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];

      this.rooms.forEach((room, roomId) => {
        if (now - room.lastActivity > this.inactivityTimeout) {
          // Close all connections in inactive room
          room.peers.forEach((ws) => {
            ws.close(4000, 'Room inactivity timeout');
          });
          toDelete.push(roomId);
          console.log(
            `[SignalingServer] Deleted inactive room ${roomId}`
          );
        }
      });

      toDelete.forEach((roomId) => this.rooms.delete(roomId));
    }, 60000); // Run cleanup every minute
  }

  public close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.heartbeatTimers.forEach((timer) => clearInterval(timer));
    this.heartbeatTimers.clear();
    this.wss.close();
    this.httpServer.close();
  }
}

// Export singleton
let instance: SignalingServer | null = null;

export function getSignalingServer(port?: number): SignalingServer {
  if (!instance) {
    instance = new SignalingServer(port);
  }
  return instance;
}
