import React, { useState, useEffect } from 'react';
import { multiplayerService } from '../../services/multiplayerService';
import type { RoomListItem, CreateRoomRequest } from '../../../shared/types/multiplayer';

interface MultiplayerLobbyProps {
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: (room: any) => void;
  onBack: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onJoinRoom,
  onCreateRoom,
  onBack
}) => {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Create room form state
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [timePerScenario, setTimePerScenario] = useState(45);
  const [totalScenarios, setTotalScenarios] = useState(5);
  const [creating, setCreating] = useState(false);

  // Load rooms on component mount
  useEffect(() => {
    loadRooms();

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadRooms = async () => {
    try {
      setError(null);
      const roomList = await multiplayerService.getRoomList();
      setRooms(roomList);
    } catch (err) {
      setError('Failed to load rooms. Please try again.');
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRooms();
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }

    if (isPrivate && !password.trim()) {
      setError('Password is required for private rooms');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const request: CreateRoomRequest = {
        name: roomName.trim(),
        maxPlayers,
        isPrivate,
        ...(isPrivate && password && { password }),
        settings: {
          maxPlayers,
          timePerScenario,
          totalScenarios,
          allowSpectators: true,
          showResponsesLive: true,
          enableVoiceChat: false,
          difficultyLevel: 'mixed'
        }
      };

      const room = await multiplayerService.createRoom(request);
      onCreateRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string, requiresPassword: boolean) => {
    if (requiresPassword) {
      const password = prompt('Enter room password:');
      if (!password) return;

      try {
        await multiplayerService.joinRoom({ roomId, password });
        onJoinRoom(roomId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room');
      }
    } else {
      try {
        await multiplayerService.joinRoom({ roomId });
        onJoinRoom(roomId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room');
      }
    }
  };

  const getGameStateDisplay = (state: string) => {
    switch (state) {
      case 'waiting': return '⏳ Waiting';
      case 'starting': return '🚀 Starting';
      case 'playing': return '🎮 Playing';
      case 'reviewing': return '📊 Reviewing';
      case 'racing': return '🏁 Racing';
      case 'finished': return '🏆 Finished';
      default: return state;
    }
  };

  if (showCreateRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <button
              onClick={() => setShowCreateRoom(false)}
              className="absolute top-4 left-4 bg-white/10 backdrop-blur-lg text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              ← Back to Lobby
            </button>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              🎮 Create Room
            </h1>
            <p className="text-purple-200">Set up your multiplayer party game</p>
          </div>

          {/* Create Room Form */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6 text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Room Name */}
              <div>
                <label className="block text-white font-semibold mb-2">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name..."
                  maxLength={50}
                  className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              {/* Max Players */}
              <div>
                <label className="block text-white font-semibold mb-2">Max Players</label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value={1}>1 Player (Testing)</option>
                  <option value={2}>2 Players</option>
                  <option value={3}>3 Players</option>
                  <option value={4}>4 Players</option>
                </select>
              </div>

              {/* Game Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-semibold mb-2">Time per Scenario</label>
                  <select
                    value={timePerScenario}
                    onChange={(e) => setTimePerScenario(Number(e.target.value))}
                    className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={45}>45 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={90}>90 seconds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">Total Scenarios</label>
                  <select
                    value={totalScenarios}
                    onChange={(e) => setTotalScenarios(Number(e.target.value))}
                    className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value={3}>3 Scenarios</option>
                    <option value={5}>5 Scenarios</option>
                    <option value={7}>7 Scenarios</option>
                    <option value={10}>10 Scenarios</option>
                  </select>
                </div>
              </div>

              {/* Privacy Settings */}
              <div>
                <label className="flex items-center gap-3 text-white">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-5 h-5 text-purple-600 bg-white/20 border-white/30 rounded focus:ring-purple-500"
                  />
                  <span className="font-semibold">Private Room</span>
                </label>
                <p className="text-purple-200 text-sm mt-1">Requires password to join</p>
              </div>

              {/* Password (if private) */}
              {isPrivate && (
                <div>
                  <label className="block text-white font-semibold mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter room password..."
                    className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              )}

              {/* Create Button */}
              <button
                onClick={handleCreateRoom}
                disabled={creating || !roomName.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
              >
                {creating ? 'Creating Room...' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={onBack}
            className="absolute top-4 left-4 bg-white/10 backdrop-blur-lg text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            ← Back to Menu
          </button>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            🎮 Multiplayer Lobby
          </h1>
          <p className="text-purple-200">Join a room or create your own party game</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <button
            onClick={() => setShowCreateRoom(true)}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">➕</span>
              <span>Create Room</span>
            </div>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-white/10 backdrop-blur-lg text-white py-4 px-6 rounded-xl font-bold hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2">
              <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
              <span>Refresh</span>
            </div>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        {/* Room List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-bold text-white">Available Rooms</h2>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white/60">Loading rooms...</p>
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <div className="text-4xl mb-4">🎮</div>
                <p>No active rooms found</p>
                <p className="text-sm mt-2">Create a room to start playing!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white/10 rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{room.name}</h3>
                          {room.isPrivate && (
                            <span className="bg-yellow-500/30 text-yellow-200 px-2 py-1 rounded text-xs">
                              🔒 Private
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-white/70">
                          <span>Host: u/{room.hostUsername}</span>
                          <span>Players: {room.playerCount}/{room.maxPlayers}</span>
                          <span>{getGameStateDisplay(room.gameState)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleJoinRoom(room.id, room.isPrivate)}
                        disabled={room.playerCount >= room.maxPlayers || room.gameState === 'playing'}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {room.playerCount >= room.maxPlayers ? 'Full' : 'Join'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Beta Notice */}
        <div className="mt-8 bg-orange-500/20 border border-orange-500/30 rounded-lg p-4 text-center">
          <div className="text-orange-200">
            <span className="font-bold">🚧 BETA FEATURE</span> - Multiplayer is in testing phase. Report bugs to improve the experience!
          </div>
        </div>
      </div>
    </div>
  );
};