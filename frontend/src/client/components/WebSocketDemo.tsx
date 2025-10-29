import { useState } from 'react';
import { useGameSession } from '../hooks/useGameSession';
import { ConnectionStatus } from './ConnectionStatus';
import type { GameSession, Door } from '../../shared/types/api';

interface WebSocketDemoProps {
  sessionId: string;
  playerId: string;
  username: string;
}

/**
 * Demo component showcasing the enhanced WebSocket integration features
 * This demonstrates all the real-time capabilities of the useGameSession hook
 */
export const WebSocketDemo = ({ sessionId, playerId, username }: WebSocketDemoProps) => {
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentDoor, setCurrentDoor] = useState<Door | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [playerPositions, setPlayerPositions] = useState<Map<string, number>>(new Map());
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  // Enhanced WebSocket integration with all event handlers
  const {
    connectionStatus,
    connectionQuality,
    lastError,
    lastHeartbeat,
    reconnectAttempts,
    isReconnecting,
    isConnected,
    sendMessage
  } = useGameSession({
    sessionId,
    playerId,
    
    // Session management
    onSessionUpdate: (updatedSession) => {
      setSession(updatedSession);
      addNotification(`Session updated: ${updatedSession.status}`);
    },
    
    // Player connection events
    onPlayerJoined: (joinedPlayerId, joinedUsername) => {
      addNotification(`${joinedUsername || joinedPlayerId} joined the game`);
    },
    
    onPlayerLeft: (leftPlayerId, leftUsername) => {
      addNotification(`${leftUsername || leftPlayerId} left the game`);
    },
    
    onPlayerReconnected: (reconnectedPlayerId, reconnectedUsername) => {
      addNotification(`${reconnectedUsername || reconnectedPlayerId} reconnected`);
    },
    
    // Game events
    onDoorPresented: (doorData) => {
      setCurrentDoor(doorData.door);
      addNotification(`New door presented! (${doorData.timeoutSeconds}s timeout)`);
    },
    
    onScoresUpdated: (scoreData) => {
      setScores(prev => new Map(prev.set(scoreData.playerId, scoreData.totalScore)));
      if (scoreData.playerId === playerId) {
        addNotification(`Your score: ${scoreData.newScore}/100 (Total: ${scoreData.totalScore})`);
      } else {
        addNotification(`Player scored: ${scoreData.newScore}/100`);
      }
    },
    
    // Real-time progress updates
    onProgressUpdate: (progress) => {
      progress.players.forEach(player => {
        setPlayerPositions(prev => new Map(prev.set(player.playerId, player.currentPosition)));
        setScores(prev => new Map(prev.set(player.playerId, player.totalScore)));
      });
      addNotification(`Progress update: ${progress.players.length} players`);
    },
    
    onPlayerPositionUpdate: (updatedPlayerId, position, totalDoors) => {
      setPlayerPositions(prev => new Map(prev.set(updatedPlayerId, position)));
      addNotification(`Player moved to door ${position}/${totalDoors}`);
    },
    
    onLeaderboardUpdate: (leaderboard) => {
      addNotification(`Leaderboard updated: ${leaderboard.length} players`);
    },
    
    // Game completion
    onGameCompleted: (results) => {
      if (results.winner) {
        addNotification(`🎉 Game completed! Winner: ${results.winner}`);
      } else {
        addNotification('🎉 Game completed!');
      }
    },
    
    // Connection restoration
    onConnectionRestored: () => {
      addNotification('✅ Connection restored successfully');
    },
    
    // Error handling
    onError: (error) => {
      addNotification(`❌ Error: ${error}`);
    }
  });

  const addNotification = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setNotifications(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const handleSendTestMessage = () => {
    const success = sendMessage({
      type: 'test-message',
      data: {
        message: 'Hello from WebSocket demo!',
        timestamp: new Date().toISOString()
      }
    });
    
    if (success) {
      addNotification('Test message sent');
    } else {
      addNotification('Failed to send test message - not connected');
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          WebSocket Integration Demo
        </h1>
        <p className="text-gray-600 mb-4">
          This demo showcases the enhanced WebSocket integration with real-time updates,
          connection monitoring, and automatic reconnection.
        </p>
        
        {/* Connection Status */}
        <div className="flex items-center gap-4 mb-4">
          <ConnectionStatus 
            status={connectionStatus}
            connectionQuality={connectionQuality}
            reconnectAttempts={reconnectAttempts}
            lastError={lastError}
            lastHeartbeat={lastHeartbeat}
            showDetails={true}
          />
          
          {isReconnecting && (
            <div className="text-sm text-blue-600">
              Attempting to reconnect...
            </div>
          )}
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Session ID:</span>
            <span className="ml-2 font-mono">{sessionId}</span>
          </div>
          <div>
            <span className="text-gray-600">Player ID:</span>
            <span className="ml-2 font-mono">{playerId}</span>
          </div>
          <div>
            <span className="text-gray-600">Username:</span>
            <span className="ml-2">{username}</span>
          </div>
          <div>
            <span className="text-gray-600">Connected:</span>
            <span className={`ml-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Session */}
      {session && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Session</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Mode:</span>
              <span className="ml-2 capitalize">{session.mode}</span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span className={`ml-2 capitalize ${
                session.status === 'active' ? 'text-green-600' :
                session.status === 'waiting' ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                {session.status}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Players:</span>
              <span className="ml-2">{session.players.length}</span>
            </div>
            {session.theme && (
              <div>
                <span className="text-gray-600">Theme:</span>
                <span className="ml-2">{session.theme}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Door */}
      {currentDoor && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Door</h2>
          <p className="text-gray-700">{currentDoor.content}</p>
          <div className="mt-4 text-sm text-gray-600">
            <span>Theme: {currentDoor.theme}</span>
            <span className="ml-4">Difficulty: {currentDoor.difficulty}</span>
          </div>
        </div>
      )}

      {/* Real-time Data */}
      <div className="grid grid-cols-2 gap-6">
        {/* Player Positions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Player Positions</h3>
          {playerPositions.size > 0 ? (
            <div className="space-y-2">
              {Array.from(playerPositions.entries()).map(([playerId, position]) => (
                <div key={playerId} className="flex justify-between text-sm">
                  <span className="font-mono">{playerId.slice(0, 8)}...</span>
                  <span>Door {position}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No position data yet</p>
          )}
        </div>

        {/* Player Scores */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Player Scores</h3>
          {scores.size > 0 ? (
            <div className="space-y-2">
              {Array.from(scores.entries()).map(([playerId, score]) => (
                <div key={playerId} className="flex justify-between text-sm">
                  <span className="font-mono">{playerId.slice(0, 8)}...</span>
                  <span>{score} pts</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No score data yet</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Controls</h3>
        <div className="flex gap-4">
          <button
            onClick={handleSendTestMessage}
            disabled={!isConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Test Message
          </button>
          <button
            onClick={clearNotifications}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Notifications
          </button>
        </div>
      </div>

      {/* Real-time Notifications */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Real-time Events</h3>
          <span className="text-sm text-gray-600">{notifications.length} events</span>
        </div>
        
        <div className="bg-gray-50 rounded p-4 h-64 overflow-y-auto">
          {notifications.length > 0 ? (
            <div className="space-y-1">
              {notifications.map((notification, index) => (
                <div key={index} className="text-sm font-mono text-gray-700">
                  {notification}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No events yet. Connect to see real-time updates!</p>
          )}
        </div>
      </div>
    </div>
  );
};