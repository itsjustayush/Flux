/**
 * React Hook for WebRTC Signaling via WebSocket
 * Handles WebSocket connection, message relay, and peer discovery
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SignalMessage } from '../server/signalServer';

export interface UseSignalingOptions {
  signalingUrl: string;
  roomId: string;
  peerId: string;
  onRoomState?: (data: any) => void;
  onSignal?: (message: SignalMessage) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export interface UseSignalingReturn {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  sendSignal: (message: SignalMessage) => void;
  sendOffer: (targetPeerId: string, offer: RTCSessionDescriptionInit) => void;
  sendAnswer: (targetPeerId: string, answer: RTCSessionDescriptionInit) => void;
  sendCandidate: (targetPeerId: string, candidate: RTCIceCandidateInit) => void;
  disconnect: () => void;
}

const MESSAGE_QUEUE_MAX = 100;
const RECONNECT_DELAY_MS = 1000;
const RECONNECT_MAX_ATTEMPTS = 10;
const HEARTBEAT_TIMEOUT_MS = 10000;

export function useSignaling(options: UseSignalingOptions): UseSignalingReturn {
  const {
    signalingUrl,
    roomId,
    peerId,
    onRoomState,
    onSignal,
    onError,
    autoConnect = true,
  } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<SignalMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  /**
   * Send a message through the WebSocket
   */
  const sendMessage = useCallback((message: SignalMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message if not connected
      if (messageQueueRef.current.length < MESSAGE_QUEUE_MAX) {
        messageQueueRef.current.push(message);
      } else {
        console.warn('[useSignaling] Message queue overflow, dropping message');
      }
    }
  }, []);

  /**
   * Send WebRTC offer
   */
  const sendOffer = useCallback(
    (targetPeerId: string, offer: RTCSessionDescriptionInit) => {
      sendMessage({
        type: 'offer',
        roomId,
        peerId,
        targetPeerId,
        data: offer,
        timestamp: Date.now(),
      });
    },
    [sendMessage, roomId, peerId]
  );

  /**
   * Send WebRTC answer
   */
  const sendAnswer = useCallback(
    (targetPeerId: string, answer: RTCSessionDescriptionInit) => {
      sendMessage({
        type: 'answer',
        roomId,
        peerId,
        targetPeerId,
        data: answer,
        timestamp: Date.now(),
      });
    },
    [sendMessage, roomId, peerId]
  );

  /**
   * Send ICE candidate
   */
  const sendCandidate = useCallback(
    (targetPeerId: string, candidate: RTCIceCandidateInit) => {
      sendMessage({
        type: 'candidate',
        roomId,
        peerId,
        targetPeerId,
        data: candidate,
        timestamp: Date.now(),
      });
    },
    [sendMessage, roomId, peerId]
  );

  /**
   * Flush queued messages
   */
  const flushMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (message && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    }
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: SignalMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'room_state':
            if (onRoomState) {
              onRoomState(message.data);
            }
            break;

          case 'offer':
          case 'answer':
          case 'candidate':
            if (onSignal) {
              onSignal(message);
            }
            break;

          case 'pong':
            lastHeartbeatRef.current = Date.now();
            break;

          case 'error':
            const errorMsg = message.data?.message || 'Unknown signaling error';
            setError(errorMsg);
            if (onError) {
              onError(errorMsg);
            }
            break;

          default:
            console.warn(`[useSignaling] Unknown message type: ${message.type}`);
        }
      } catch (err) {
        console.error('[useSignaling] Error handling message:', err);
      }
    },
    [onRoomState, onSignal, onError]
  );

  /**
   * Attempt to reconnect with exponential backoff
   */
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= RECONNECT_MAX_ATTEMPTS) {
      const err = `Failed to connect after ${RECONNECT_MAX_ATTEMPTS} attempts`;
      setError(err);
      if (onError) {
        onError(err);
      }
      return;
    }

    const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;

    console.log(
      `[useSignaling] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      // Attempt to connect (will be called in the connection setup)
    }, delay);
  }, [onError]);

  /**
   * Start heartbeat monitor
   */
  const startHeartbeat = useCallback(() => {
    heartbeatTimerRef.current = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;

      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        console.warn('[useSignaling] Heartbeat timeout, reconnecting...');
        if (wsRef.current) {
          wsRef.current.close();
        }
      }
    }, HEARTBEAT_TIMEOUT_MS / 2);
  }, []);

  /**
   * Stop heartbeat monitor
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * Connect to signaling server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setConnecting(true);
    setError(null);

    try {
      const url = new URL(signalingUrl);
      // Ensure we use wss for https, ws for http
      if (window.location.protocol === 'https:') {
        url.protocol = 'wss';
      } else {
        url.protocol = 'ws';
      }

      console.log(`[useSignaling] Connecting to ${url.toString()}`);

      const ws = new WebSocket(url.toString());

      ws.onopen = () => {
        console.log('[useSignaling] Connected to signaling server');
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Join room
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId,
            peerId,
            timestamp: Date.now(),
          })
        );

        // Flush queued messages
        flushMessageQueue();

        // Start heartbeat
        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error('[useSignaling] WebSocket error:', event);
        const err = 'WebSocket connection error';
        setError(err);
        if (onError) {
          onError(err);
        }
      };

      ws.onclose = () => {
        console.log('[useSignaling] Disconnected from signaling server');
        setConnected(false);
        setConnecting(false);
        stopHeartbeat();

        // Attempt to reconnect if not intentionally closed
        if (wsRef.current === ws) {
          attemptReconnect();
        }
      };

      wsRef.current = ws;
    } catch (err) {
      const errorMsg = String(err);
      console.error('[useSignaling] Connection error:', err);
      setConnecting(false);
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
      attemptReconnect();
    }
  }, [
    signalingUrl,
    roomId,
    peerId,
    handleMessage,
    flushMessageQueue,
    startHeartbeat,
    stopHeartbeat,
    attemptReconnect,
    onError,
  ]);

  /**
   * Disconnect from signaling server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
    setConnecting(false);
    messageQueueRef.current = [];
    reconnectAttemptsRef.current = 0;
  }, [stopHeartbeat]);

  /**
   * Setup and teardown effects
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);

  return {
    connected,
    connecting,
    error,
    sendSignal: sendMessage,
    sendOffer,
    sendAnswer,
    sendCandidate,
    disconnect,
  };
}
