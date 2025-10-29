import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocketErrorHandler } from './useErrorHandler';
import type { GameSession, PlayerInfo, Door } from '../../shared/types/api';

// WebSocket event types based on backend implementation
interface WebSocketEvent {
  type: string;
  sessionId: string;
  playerId?: string;
  data: any;
  timestamp: string;
}

// Enhanced event data types for better type safety
interface DoorPresentedData {
  door: Door;
  timeoutSeconds: number;
}

interface ScoreUpdateData {
  playerId: string;
  newScore: number;
  totalScore: number;
  scoringMetrics?: {
    creativity: number;
    feasibility: number;
    humor: number;
    originality: number;
  };
}

interface GameCompletedData {
  winner?: string;
  rankings: Array<{
    playerId: string;
    username: string;
    position: number;
    totalScore: number;
    completionTime: string;
  }>;
  statistics: Array<{
    playerId: string;
    averageScore: number;
    doorsCompleted: number;
    totalTime: string;
  }>;
}

interface PlayerProgress {
  playerId: string;
  username: string;
  currentPosition: number;
  totalDoors: number;
  totalScore: number;
  averageScore: number;
  doorsCompleted: number;
  isActive: boolean;
  lastResponseAt?: string;
}

interface SessionProgress {
  sessionId: string;
  players: PlayerProgress[];
  currentDoorId?: string;
  gameStatus: string;
  leaderPlayerId?: string;
  updatedAt: string;
}

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

interface UseGameSessionOptions {
  sessionId: string;
  playerId: string;
  onSessionUpdate?: (session: GameSession) => void;
  onPlayerJoined?: (playerId: string, username?: string) => void;
  onPlayerLeft?: (playerId: string, username?: string) => void;
  onPlayerReconnected?: (playerId: string, username?: string) => void;
  onDoorPresented?: (data: DoorPresentedData) => void;
  onScoresUpdated?: (data: ScoreUpdateData) => void;
  onProgressUpdate?: (progress: SessionProgress) => void;
  onPlayerPositionUpdate?: (playerId: string, position: number, totalDoors: number) => void;
  onLeaderboardUpdate?: (leaderboard: PlayerProgress[]) => void;
  onGameCompleted?: (results: GameCompletedData) => void;
  onConnectionRestored?: () => void;
  onError?: (error: string) => void;
}

interface GameSessionState {
  session: GameSession | null;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  reconnectAttempts: number;
  isReconnecting: boolean;
  lastHeartbeat: Date | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

export const useGameSession = (options: UseGameSessionOptions) => {
  const {
    sessionId,
    playerId,
    onSessionUpdate,
    onPlayerJoined,
    onPlayerLeft,
    onPlayerReconnected,
    onDoorPresented,
    onScoresUpdated,
    onProgressUpdate,
    onPlayerPositionUpdate,
    onLeaderboardUpdate,
    onGameCompleted,
    onConnectionRestored,
    onError,
  } = options;

  const wsErrorHandler = useWebSocketErrorHandler({
    maxRetries: 5,
    retryDelay: 2000,
    onError: (error, context) => {
      console.error('WebSocket error:', error, context);
      onError?.(error.message);
    },
  });

  const [state, setState] = useState<GameSessionState>({
    session: null,
    connectionStatus: wsErrorHandler.connectionState,
    lastError: wsErrorHandler.errorState.error?.message || null,
    reconnectAttempts: wsErrorHandler.errorState.retryCount,
    isReconnecting: wsErrorHandler.errorState.hasError,
    lastHeartbeat: null,
    connectionQuality: 'unknown',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // Start with 2 seconds
  const heartbeatInterval = 30000; // 30 seconds
  const heartbeatTimeout = 10000; // 10 seconds to wait for heartbeat response
  const connectionQualityCheckInterval = 5000; // Check connection quality every 5 seconds

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Update connection status
  const updateConnectionStatus = useCallback((status: ConnectionStatus, error?: string) => {
    setState((prev) => ({
      ...prev,
      connectionStatus: status,
      lastError: error || null,
      isReconnecting: status === 'reconnecting',
      connectionQuality: status === 'connected' ? 'good' : prev.connectionQuality,
    }));
  }, []);

  // Update connection quality based on heartbeat response times
  const updateConnectionQuality = useCallback((responseTime: number) => {
    let quality: 'excellent' | 'good' | 'poor' | 'unknown';

    if (responseTime < 100) {
      quality = 'excellent';
    } else if (responseTime < 500) {
      quality = 'good';
    } else {
      quality = 'poor';
    }

    setState((prev) => ({
      ...prev,
      connectionQuality: quality,
      lastHeartbeat: new Date(),
    }));
  }, []);

  // Handle WebSocket events
  const handleWebSocketEvent = useCallback(
    (event: WebSocketEvent) => {
      console.log('WebSocket event received:', event);

      switch (event.type) {
        case 'connection-established':
          updateConnectionStatus('connected');
          if (event.data.session) {
            setState((prev) => ({ ...prev, session: event.data.session }));
            onSessionUpdate?.(event.data.session);
          }
          onConnectionRestored?.();
          break;

        case 'player-connected':
        case 'player-joined':
          if (event.playerId && event.playerId !== playerId) {
            const username = event.data?.username || event.data?.playerId;
            onPlayerJoined?.(event.playerId, username);

            // Update session state if we have player info
            if (event.data?.playerInfo) {
              setState((prev) => {
                if (!prev.session) return prev;

                const updatedPlayers = [...prev.session.players];
                const existingIndex = updatedPlayers.findIndex(
                  (p) => p.playerId === event.playerId
                );

                if (existingIndex === -1) {
                  updatedPlayers.push(event.data.playerInfo);
                } else {
                  updatedPlayers[existingIndex] = {
                    ...updatedPlayers[existingIndex],
                    ...event.data.playerInfo,
                  };
                }

                const updatedSession = { ...prev.session, players: updatedPlayers };
                onSessionUpdate?.(updatedSession);
                return { ...prev, session: updatedSession };
              });
            }
          }
          break;

        case 'player-disconnected':
        case 'player-left':
          if (event.playerId && event.playerId !== playerId) {
            const username = event.data?.username || event.data?.playerId;
            onPlayerLeft?.(event.playerId, username);

            // Update player status in session
            setState((prev) => {
              if (!prev.session) return prev;

              const updatedPlayers = prev.session.players.map((player) => {
                if (player.playerId === event.playerId) {
                  return { ...player, isActive: false };
                }
                return player;
              });

              const updatedSession = { ...prev.session, players: updatedPlayers };
              onSessionUpdate?.(updatedSession);
              return { ...prev, session: updatedSession };
            });
          }
          break;

        case 'player-reconnected':
          if (event.playerId && event.playerId !== playerId) {
            const username = event.data?.username || event.data?.playerId;
            onPlayerReconnected?.(event.playerId, username);

            // Update player status in session
            setState((prev) => {
              if (!prev.session) return prev;

              const updatedPlayers = prev.session.players.map((player) => {
                if (player.playerId === event.playerId) {
                  return { ...player, isActive: true };
                }
                return player;
              });

              const updatedSession = { ...prev.session, players: updatedPlayers };
              onSessionUpdate?.(updatedSession);
              return { ...prev, session: updatedSession };
            });
          }
          break;

        case 'door-presented':
        case 'game:door-presented':
          const doorData: DoorPresentedData = {
            door: event.data.door || event.data,
            timeoutSeconds: event.data.timeoutSeconds || 60,
          };
          onDoorPresented?.(doorData);

          // Update session with current door
          setState((prev) => {
            if (!prev.session) return prev;

            const updatedSession = {
              ...prev.session,
              currentDoor: doorData.door,
              status: 'active' as const,
            };

            onSessionUpdate?.(updatedSession);
            return { ...prev, session: updatedSession };
          });
          break;

        case 'scores-updated':
        case 'game:scores-updated':
        case 'player-score-update':
          const scoreData: ScoreUpdateData = {
            playerId: event.playerId || event.data.playerId,
            newScore: event.data.newScore,
            totalScore: event.data.totalScore,
            scoringMetrics: event.data.scoringMetrics,
          };
          onScoresUpdated?.(scoreData);

          // Update player score in session
          setState((prev) => {
            if (!prev.session) return prev;

            const updatedPlayers = prev.session.players.map((player) => {
              if (player.playerId === scoreData.playerId) {
                return {
                  ...player,
                  totalScore: scoreData.totalScore,
                  responses: player.responses.map((response) =>
                    response.responseId === event.data.responseId
                      ? {
                          ...response,
                          aiScore: scoreData.newScore,
                          scoringMetrics: scoreData.scoringMetrics || response.scoringMetrics,
                        }
                      : response
                  ),
                };
              }
              return player;
            });

            const updatedSession = { ...prev.session, players: updatedPlayers };
            onSessionUpdate?.(updatedSession);
            return { ...prev, session: updatedSession };
          });
          break;

        case 'progress-update':
          if (event.data && event.data.players) {
            onProgressUpdate?.(event.data);

            // Update session with new player progress
            setState((prev) => {
              if (!prev.session) return prev;

              const updatedPlayers = prev.session.players.map((player) => {
                const progressData = event.data.players.find(
                  (p: PlayerProgress) => p.playerId === player.playerId
                );
                if (progressData) {
                  return {
                    ...player,
                    currentPosition: progressData.currentPosition,
                    totalScore: progressData.totalScore,
                    isActive: progressData.isActive,
                  };
                }
                return player;
              });

              const updatedSession = {
                ...prev.session,
                players: updatedPlayers,
                status: event.data.gameStatus || prev.session.status,
              };

              onSessionUpdate?.(updatedSession);
              return { ...prev, session: updatedSession };
            });
          }
          break;

        case 'player-position-update':
          if (event.playerId && event.data) {
            onPlayerPositionUpdate?.(
              event.playerId,
              event.data.currentPosition,
              event.data.totalDoors
            );

            setState((prev) => {
              if (!prev.session) return prev;

              const updatedPlayers = prev.session.players.map((player) => {
                if (player.playerId === event.playerId) {
                  return {
                    ...player,
                    currentPosition: event.data.currentPosition,
                  };
                }
                return player;
              });

              const updatedSession = { ...prev.session, players: updatedPlayers };
              onSessionUpdate?.(updatedSession);
              return { ...prev, session: updatedSession };
            });
          }
          break;

        case 'leaderboard-update':
          if (event.data && event.data.leaderboard) {
            onLeaderboardUpdate?.(event.data.leaderboard);
          }
          break;

        case 'game-completed':
        case 'game:game-completed':
        case 'final-rankings':
          const gameResults: GameCompletedData = {
            winner: event.data.winner,
            rankings: event.data.rankings || [],
            statistics: event.data.statistics || [],
          };
          onGameCompleted?.(gameResults);

          // Update session status
          setState((prev) => {
            if (!prev.session) return prev;

            const updatedSession = {
              ...prev.session,
              status: 'completed' as const,
              completedAt: new Date().toISOString(),
            };

            onSessionUpdate?.(updatedSession);
            return { ...prev, session: updatedSession };
          });
          break;

        case 'performance-statistics':
          console.log('Performance statistics:', event.data);
          break;

        case 'heartbeat-response':
          // Handle heartbeat response for connection quality monitoring
          const responseTime = Date.now() - (event.data?.timestamp || 0);
          updateConnectionQuality(responseTime);
          break;

        case 'error':
          const errorMessage = event.data?.message || 'WebSocket error occurred';
          updateConnectionStatus('error', errorMessage);
          onError?.(errorMessage);
          break;

        default:
          console.log('Unhandled WebSocket event:', event.type, event.data);
      }
    },
    [
      playerId,
      onSessionUpdate,
      onPlayerJoined,
      onPlayerLeft,
      onPlayerReconnected,
      onDoorPresented,
      onScoresUpdated,
      onProgressUpdate,
      onPlayerPositionUpdate,
      onLeaderboardUpdate,
      onGameCompleted,
      onConnectionRestored,
      onError,
      updateConnectionStatus,
      updateConnectionQuality,
    ]
  );

  // Send heartbeat to keep connection alive and monitor quality
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const heartbeatTime = Date.now();

      wsRef.current.send(
        JSON.stringify({
          type: 'heartbeat',
          timestamp: heartbeatTime,
          sessionId,
          playerId,
        })
      );

      // Set timeout for heartbeat response
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }

      heartbeatTimeoutRef.current = setTimeout(() => {
        // No heartbeat response received, connection might be poor
        setState((prev) => ({
          ...prev,
          connectionQuality: 'poor',
        }));

        console.warn('Heartbeat timeout - connection quality degraded');
      }, heartbeatTimeout);
    }
  }, [sessionId, playerId]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    clearTimers();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, heartbeatInterval);
  }, [sendHeartbeat, clearTimers]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    updateConnectionStatus('connecting');

    try {
      // Construct WebSocket URL with query parameters
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws?sessionId=${encodeURIComponent(sessionId)}&playerId=${encodeURIComponent(playerId)}`;

      console.log('Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          updateConnectionStatus('error', 'Connection timeout');
          attemptReconnect();
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connected');
        wsErrorHandler.handleConnectionSuccess();
        updateConnectionStatus('connected');
        setState((prev) => ({
          ...prev,
          reconnectAttempts: 0,
          connectionQuality: 'good',
          lastHeartbeat: new Date(),
        }));
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Update last activity timestamp
          setState((prev) => ({
            ...prev,
            lastHeartbeat: new Date(),
          }));

          handleWebSocketEvent(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, event.data);
          onError?.('Failed to parse server message');
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket closed:', event.code, event.reason);
        clearTimers();

        wsErrorHandler.handleConnectionClose(event);

        // Handle different close codes
        if (event.code === 1000) {
          // Normal closure
          updateConnectionStatus('disconnected');
        } else if (event.code === 1006) {
          // Abnormal closure (network issue)
          updateConnectionStatus('disconnected');
          attemptReconnect();
        } else if (event.code >= 4000) {
          // Custom error codes (server-side errors)
          const errorMessage = event.reason || 'Server error occurred';
          updateConnectionStatus('error', errorMessage);
          onError?.(errorMessage);
        } else {
          // Other unexpected closures
          updateConnectionStatus('disconnected');
          attemptReconnect();
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket error:', error);
        wsErrorHandler.handleConnectionError(error, 'websocket_error');
        updateConnectionStatus('error', 'WebSocket connection error');
        onError?.('WebSocket connection error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      updateConnectionStatus('error', 'Failed to create WebSocket connection');
      onError?.('Failed to create WebSocket connection');
    }
  }, [
    sessionId,
    playerId,
    updateConnectionStatus,
    handleWebSocketEvent,
    startHeartbeat,
    clearTimers,
    onError,
    attemptReconnect,
  ]);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    setState((prev) => {
      if (prev.reconnectAttempts >= maxReconnectAttempts) {
        updateConnectionStatus('error', 'Maximum reconnection attempts exceeded');
        onError?.('Connection lost. Please refresh the page.');
        return prev;
      }

      updateConnectionStatus('reconnecting');

      const delay = reconnectDelay * Math.pow(2, prev.reconnectAttempts);
      console.log(
        `Attempting to reconnect in ${delay}ms (attempt ${prev.reconnectAttempts + 1}/${maxReconnectAttempts})`
      );

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);

      return {
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1,
      };
    });
  }, [connect, updateConnectionStatus, onError]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    updateConnectionStatus('disconnected');
  }, [clearTimers, updateConnectionStatus]);

  // Send message to WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket not connected, cannot send message:', message);
    return false;
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    if (sessionId && playerId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, playerId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, [clearTimers]);

  return {
    session: state.session,
    connectionStatus: state.connectionStatus,
    connectionQuality: state.connectionQuality,
    lastError: state.lastError,
    lastHeartbeat: state.lastHeartbeat,
    reconnectAttempts: state.reconnectAttempts,
    isReconnecting: state.isReconnecting,
    isConnected: state.connectionStatus === 'connected',
    connect,
    disconnect,
    sendMessage,
  };
};
