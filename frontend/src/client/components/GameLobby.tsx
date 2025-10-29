import { useState } from 'react';
import type { GameMode, GameSession, CreateSessionRequest, JoinSessionRequest } from '../../shared/types/api';

interface GameLobbyProps {
  onSessionCreated: (session: GameSession) => void;
  onSessionJoined: (session: GameSession) => void;
  username: string;
}

export const GameLobby = ({ onSessionCreated, onSessionJoined, username }: GameLobbyProps) => {
  const [mode, setMode] = useState<GameMode>('multiplayer');
  const [theme, setTheme] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const request: CreateSessionRequest = {
        mode,
        ...(mode === 'single-player' && theme && { theme })
      };

      const response = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      onSessionCreated(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!sessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: JoinSessionRequest = { sessionId: sessionId.trim() };

      const response = await fetch(`/api/game/join/${sessionId.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to join session: ${response.status}`);
      }

      const data = await response.json();
      onSessionJoined(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          Welcome to DumDoors!
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Hey {username}! Ready to solve some creative challenges?
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Create New Session */}
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Create New Game</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Game Mode
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="multiplayer"
                      checked={mode === 'multiplayer'}
                      onChange={(e) => setMode(e.target.value as GameMode)}
                      className="mr-2"
                      disabled={loading}
                    />
                    Multiplayer (Race)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="single-player"
                      checked={mode === 'single-player'}
                      onChange={(e) => setMode(e.target.value as GameMode)}
                      className="mr-2"
                      disabled={loading}
                    />
                    Single Player
                  </label>
                </div>
              </div>

              {mode === 'single-player' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Theme (Optional)
                  </label>
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g., workplace, fantasy, sci-fi"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
              )}

              <button
                onClick={handleCreateSession}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </div>

          {/* Join Existing Session */}
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Join Existing Game</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session ID
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Enter session ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleJoinSession}
                disabled={loading || !sessionId.trim()}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};