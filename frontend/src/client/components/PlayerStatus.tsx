import { useState, useEffect } from 'react';
import type { GameSession, PlayerInfo } from '../../shared/types/api';
import { useGameSession } from '../hooks/useGameSession';
import { ConnectionStatus } from './ConnectionStatus';

interface PlayerStatusProps {
  session: GameSession;
  currentUser: string;
  playerId: string;
  onSessionUpdate?: (session: GameSession) => void;
}

export const PlayerStatus = ({ session, currentUser, playerId, onSessionUpdate }: PlayerStatusProps) => {
  const [realtimeSession, setRealtimeSession] = useState<GameSession>(session);
  const [playerUpdates, setPlayerUpdates] = useState<Map<string, { position: number; score: number; timestamp: number }>>(new Map());

  // Enhanced WebSocket integration for real-time updates
  const {
    connectionStatus,
    connectionQuality,
    lastError,
    isConnected
  } = useGameSession({
    sessionId: session.sessionId,
    playerId,
    onSessionUpdate: (updatedSession) => {
      setRealtimeSession(updatedSession);
      onSessionUpdate?.(updatedSession);
    },
    onPlayerPositionUpdate: (updatedPlayerId, position, totalDoors) => {
      setPlayerUpdates(prev => new Map(prev.set(updatedPlayerId, {
        position,
        score: prev.get(updatedPlayerId)?.score || 0,
        timestamp: Date.now()
      })));
    },
    onScoresUpdated: (scoreData) => {
      setPlayerUpdates(prev => new Map(prev.set(scoreData.playerId, {
        position: prev.get(scoreData.playerId)?.position || 0,
        score: scoreData.totalScore,
        timestamp: Date.now()
      })));
    },
    onProgressUpdate: (progress) => {
      // Update player positions from progress data
      progress.players.forEach(playerProgress => {
        setPlayerUpdates(prev => new Map(prev.set(playerProgress.playerId, {
          position: playerProgress.currentPosition,
          score: playerProgress.totalScore,
          timestamp: Date.now()
        })));
      });
    }
  });

  // Clear old player updates after 30 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setPlayerUpdates(prev => {
        const updated = new Map(prev);
        for (const [playerId, update] of updated.entries()) {
          if (now - update.timestamp > 30000) { // 30 seconds
            updated.delete(playerId);
          }
        }
        return updated;
      });
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);
  // Use real-time session data and merge with live updates
  const getPlayerData = (player: PlayerInfo) => {
    const update = playerUpdates.get(player.playerId);
    return {
      ...player,
      currentPosition: update?.position ?? player.currentPosition,
      totalScore: update?.score ?? player.totalScore,
      hasRecentUpdate: update && (Date.now() - update.timestamp < 5000) // Show animation for 5 seconds
    };
  };

  const sortedPlayers = [...realtimeSession.players].map(getPlayerData).sort((a, b) => {
    // Sort by position (lower is better), then by total score (higher is better)
    if (a.currentPosition !== b.currentPosition) {
      return a.currentPosition - b.currentPosition;
    }
    return b.totalScore - a.totalScore;
  });

  const getPlayerRank = (player: PlayerInfo) => {
    return sortedPlayers.findIndex(p => p.playerId === player.playerId) + 1;
  };

  const getProgressPercentage = (player: PlayerInfo) => {
    // Estimate progress based on position (assuming 10 doors max for visualization)
    const estimatedTotalDoors = 10;
    const progress = Math.max(0, (estimatedTotalDoors - player.currentPosition) / estimatedTotalDoors * 100);
    return Math.min(100, progress);
  };

  const getPlayerStatusIcon = (player: PlayerInfo & { hasRecentUpdate?: boolean }) => {
    if (!player.isActive) return '💤';
    
    const hasSubmittedCurrentDoor = realtimeSession.currentDoor && 
      player.responses.some(r => r.doorId === realtimeSession.currentDoor?.doorId);
    
    if (hasSubmittedCurrentDoor) return '✅';
    if (realtimeSession.status === 'active') return '✏️';
    return '⏳';
  };

  const getPlayerStatusText = (player: PlayerInfo & { hasRecentUpdate?: boolean }) => {
    if (!player.isActive) return 'Disconnected';
    
    const hasSubmittedCurrentDoor = realtimeSession.currentDoor && 
      player.responses.some(r => r.doorId === realtimeSession.currentDoor?.doorId);
    
    if (hasSubmittedCurrentDoor) return 'Submitted';
    if (realtimeSession.status === 'active') return 'Responding...';
    return 'Waiting';
  };

  const formatScore = (score: number) => {
    return score.toFixed(0);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {realtimeSession.mode === 'multiplayer' ? 'Race Progress' : 'Your Progress'}
        </h2>
        <div className="flex items-center gap-4">
          <ConnectionStatus 
            status={connectionStatus}
            connectionQuality={connectionQuality}
            lastError={lastError}
            showDetails={false}
          />
          <div className="text-sm text-gray-600">
            Session: {realtimeSession.sessionId}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sortedPlayers.map((player) => {
          const isCurrentUser = player.username === currentUser;
          const rank = getPlayerRank(player);
          const progress = getProgressPercentage(player);
          
          return (
            <div
              key={player.playerId}
              className={`border rounded-lg p-4 transition-all duration-300 ${
                isCurrentUser 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              } ${
                player.hasRecentUpdate ? 'ring-2 ring-green-300 animate-pulse' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold ${
                    rank === 1 ? 'text-yellow-600' : 
                    rank === 2 ? 'text-gray-500' : 
                    rank === 3 ? 'text-orange-600' : 'text-gray-400'
                  }`}>
                    #{rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
                        {player.username}
                        {isCurrentUser && ' (You)'}
                      </span>
                      <span className="text-lg">
                        {getPlayerStatusIcon(player)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {getPlayerStatusText(player)}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    Door {player.currentPosition}
                  </div>
                  <div className="text-sm text-gray-600">
                    Score: {formatScore(player.totalScore)}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    isCurrentUser ? 'bg-blue-600' : 'bg-gray-400'
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              {/* Recent Performance */}
              {player.responses.length > 0 && (
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="text-gray-600">Recent scores:</span>
                  <div className="flex gap-1">
                    {player.responses.slice(-3).map((response) => (
                      <span
                        key={response.responseId}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          response.aiScore >= 70 ? 'bg-green-100 text-green-800' :
                          response.aiScore >= 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}
                      >
                        {response.aiScore}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Game Info */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Game Mode:</span>
            <span className="ml-2 font-medium capitalize">
              {session.mode.replace('-', ' ')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <span className={`ml-2 font-medium capitalize ${
              realtimeSession.status === 'active' ? 'text-green-600' :
              realtimeSession.status === 'waiting' ? 'text-yellow-600' :
              'text-gray-600'
            }`}>
              {realtimeSession.status}
            </span>
          </div>
          {realtimeSession.theme && (
            <div className="col-span-2">
              <span className="text-gray-600">Theme:</span>
              <span className="ml-2 font-medium">{realtimeSession.theme}</span>
            </div>
          )}
          {!isConnected && (
            <div className="col-span-2 text-sm text-red-600">
              ⚠️ Real-time updates may be delayed due to connection issues
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <div className="flex items-center gap-4 flex-wrap">
            <span>✅ Submitted</span>
            <span>✏️ Responding</span>
            <span>⏳ Waiting</span>
            <span>💤 Disconnected</span>
          </div>
        </div>
      </div>
    </div>
  );
};