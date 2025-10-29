import { useState, useEffect } from 'react';
import type { GameSession, SubmitResponseRequest, Door } from '../../shared/types/api';
import { useGameSession } from '../hooks/useGameSession';
import { ConnectionStatus } from './ConnectionStatus';
import { ResponseInput } from './ResponseInput';

interface GameBoardProps {
  session: GameSession;
  currentUser: string;
  playerId: string;
  onResponseSubmitted: () => void;
  onSessionUpdate?: (session: GameSession) => void;
}

export const GameBoard = ({ session, currentUser, playerId, onResponseSubmitted, onSessionUpdate }: GameBoardProps) => {
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [currentDoor, setCurrentDoor] = useState<Door | null>(session.currentDoor || null);
  const [gameNotifications, setGameNotifications] = useState<string[]>([]);

  const currentPlayer = session.players.find(p => p.username === currentUser);

  // Enhanced WebSocket integration
  const {
    connectionStatus,
    connectionQuality,
    lastError: wsError,
    lastHeartbeat,
    isConnected
  } = useGameSession({
    sessionId: session.sessionId,
    playerId,
    onSessionUpdate: (updatedSession) => {
      onSessionUpdate?.(updatedSession);
    },
    onPlayerJoined: (joinedPlayerId, username) => {
      if (joinedPlayerId !== playerId) {
        setGameNotifications(prev => [...prev, `${username || joinedPlayerId} joined the game`]);
      }
    },
    onPlayerLeft: (leftPlayerId, username) => {
      if (leftPlayerId !== playerId) {
        setGameNotifications(prev => [...prev, `${username || leftPlayerId} left the game`]);
      }
    },
    onPlayerReconnected: (reconnectedPlayerId, username) => {
      if (reconnectedPlayerId !== playerId) {
        setGameNotifications(prev => [...prev, `${username || reconnectedPlayerId} reconnected`]);
      }
    },
    onDoorPresented: (doorData) => {
      setCurrentDoor(doorData.door);
      setTimeLeft(doorData.timeoutSeconds);
      setSubmitted(false);
      setError(null);
      setGameNotifications(prev => [...prev, 'New door presented!']);
    },
    onScoresUpdated: (scoreData) => {
      if (scoreData.playerId === playerId) {
        setGameNotifications(prev => [...prev, `Your score: ${scoreData.newScore}/100`]);
      }
    },
    onProgressUpdate: (progress) => {
      // Handle real-time progress updates
      console.log('Progress update:', progress);
    },
    onPlayerPositionUpdate: (updatedPlayerId, position, totalDoors) => {
      if (updatedPlayerId !== playerId) {
        const player = session.players.find(p => p.playerId === updatedPlayerId);
        const username = player?.username || updatedPlayerId;
        setGameNotifications(prev => [...prev, `${username} moved to door ${position}/${totalDoors}`]);
      }
    },
    onGameCompleted: (results) => {
      if (results.winner) {
        const winner = session.players.find(p => p.playerId === results.winner);
        setGameNotifications(prev => [...prev, `🎉 ${winner?.username || results.winner} won the game!`]);
      }
    },
    onError: (errorMsg) => {
      setError(`Connection error: ${errorMsg}`);
    }
  });

  // Timer countdown
  useEffect(() => {
    if (session.status !== 'active' || submitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session.status, submitted, timeLeft]);

  // Clear old notifications
  useEffect(() => {
    if (gameNotifications.length > 0) {
      const timer = setTimeout(() => {
        setGameNotifications(prev => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [gameNotifications]);

  const handleSubmitResponse = async (response: string) => {
    setError(null);

    try {
      const request: SubmitResponseRequest = {
        sessionId: session.sessionId,
        response: response
      };

      const res = await fetch('/api/game/submit-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!res.ok) {
        throw new Error(`Failed to submit response: ${res.status}`);
      }

      setSubmitted(true);
      onResponseSubmitted();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit response';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSubmissionStatus = () => {
    const submittedCount = session.players.filter(p => 
      p.responses.some(r => r.doorId === session.currentDoor?.doorId)
    ).length;
    return `${submittedCount}/${session.players.length} players responded`;
  };

  if (!currentDoor) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Waiting for next door...</p>
          <div className="mt-4">
            <ConnectionStatus 
              status={connectionStatus}
              connectionQuality={connectionQuality}
              lastError={wsError}
              lastHeartbeat={lastHeartbeat}
              showDetails={true}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Connection Status and Notifications */}
      <div className="flex justify-between items-center">
        <ConnectionStatus 
          status={connectionStatus}
          connectionQuality={connectionQuality}
          lastError={wsError}
          lastHeartbeat={lastHeartbeat}
          showDetails={false}
        />
        
        {/* Game Notifications */}
        {gameNotifications.length > 0 && (
          <div className="flex flex-col gap-1">
            {gameNotifications.slice(-3).map((notification, index) => (
              <div 
                key={index}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm animate-fade-in"
              >
                {notification}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Door {currentPlayer?.currentPosition || 1}
          </h1>
          <div className="flex items-center gap-4">
            <div className={`text-lg font-mono ${timeLeft <= 10 ? 'text-red-600' : 'text-gray-700'}`}>
              ⏱️ {formatTime(timeLeft)}
            </div>
            <div className="text-sm text-gray-600">
              {getSubmissionStatus()}
            </div>
            {!isConnected && (
              <div className="text-sm text-red-600">
                ⚠️ Connection issues may affect real-time updates
              </div>
            )}
          </div>
        </div>

        {session.mode === 'multiplayer' && (
          <div className="text-sm text-blue-600 mb-2">
            🏁 Race Mode: First to complete all doors wins!
          </div>
        )}

        {session.theme && (
          <div className="text-sm text-blue-600 mb-2">
            🎭 Theme: {session.theme}
          </div>
        )}
      </div>

      {/* Door Content */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🚪</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            The Situation
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto">
            {currentDoor.content}
          </p>
        </div>
      </div>

      {/* Response Input */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          How would you handle this situation?
        </h3>

        <ResponseInput
          onSubmit={handleSubmitResponse}
          disabled={!isConnected}
          timeLeft={timeLeft}
          maxLength={500}
          placeholder="Describe your creative solution..."
          submitted={submitted}
          error={error || wsError}
        />
      </div>

      {/* Waiting for Others */}
      {submitted && session.mode === 'multiplayer' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="animate-pulse text-yellow-600">⏳</div>
            <span className="text-yellow-800">
              Waiting for other players to submit their responses...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};