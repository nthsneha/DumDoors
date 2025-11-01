import React, { useState, useEffect, useRef } from 'react';
import { multiplayerService } from '../../services/multiplayerService';
import { VoiceResponseInput } from '../VoiceResponseInput';
import { MultiplayerMinimap } from './MultiplayerMinimap';
import type { 
  MultiplayerRoom as Room, 
  MultiplayerPlayer, 
  GameScenario,
  PlayerResponse 
} from '../../../shared/types/multiplayer';

interface MultiplayerRoomProps {
  roomId: string;
  onLeaveRoom: () => void;
}

interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  message: string;
  timestamp: string;
}

export const MultiplayerRoom: React.FC<MultiplayerRoomProps> = ({
  roomId,
  onLeaveRoom
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<MultiplayerPlayer | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | undefined>();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [currentResponses, setCurrentResponses] = useState<PlayerResponse[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load room data and set up event listeners
  useEffect(() => {
    loadRoom();
    setupEventListeners();

    return () => {
      cleanupEventListeners();
    };
  }, [roomId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadRoom = async () => {
    try {
      const roomData = await multiplayerService.getCurrentRoom();
      if (roomData) {
        setRoom(roomData);
        // Find current player
        const player = roomData.players.find(p => p.id === multiplayerService.currentPlayer);
        setCurrentPlayer(player || null);
      }
    } catch (err) {
      setError('Failed to load room data');
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = () => {
    multiplayerService.on('room_updated', handleRoomUpdate);
    multiplayerService.on('player_joined', handlePlayerJoined);
    multiplayerService.on('player_left', handlePlayerLeft);
    multiplayerService.on('game_started', handleGameStarted);
    multiplayerService.on('response_submitted', handleResponseSubmitted);
    multiplayerService.on('scenario_completed', handleScenarioCompleted);
    multiplayerService.on('player_moved', handlePlayerMoved);
    multiplayerService.on('game_finished', handleGameFinished);
    multiplayerService.on('chat_message', handleChatMessage);
    multiplayerService.on('error', handleError);
  };

  const cleanupEventListeners = () => {
    multiplayerService.off('room_updated', handleRoomUpdate);
    multiplayerService.off('player_joined', handlePlayerJoined);
    multiplayerService.off('player_left', handlePlayerLeft);
    multiplayerService.off('game_started', handleGameStarted);
    multiplayerService.off('response_submitted', handleResponseSubmitted);
    multiplayerService.off('scenario_completed', handleScenarioCompleted);
    multiplayerService.off('player_moved', handlePlayerMoved);
    multiplayerService.off('game_finished', handleGameFinished);
    multiplayerService.off('chat_message', handleChatMessage);
    multiplayerService.off('error', handleError);
  };

  // Event handlers
  const handleRoomUpdate = (data: Room) => {
    setRoom(data);
    const player = data.players.find(p => p.id === multiplayerService.currentPlayer);
    setCurrentPlayer(player || null);
  };

  const handlePlayerJoined = (data: { roomId: string; player: MultiplayerPlayer }) => {
    if (data.roomId === roomId) {
      addChatMessage({
        id: `join_${Date.now()}`,
        playerId: 'system',
        username: 'System',
        message: `${data.player.username} joined the room`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handlePlayerLeft = (data: { roomId: string; playerId: string }) => {
    if (data.roomId === roomId) {
      addChatMessage({
        id: `leave_${Date.now()}`,
        playerId: 'system',
        username: 'System',
        message: `A player left the room`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleGameStarted = (data: { roomId: string; scenario: GameScenario }) => {
    if (data.roomId === roomId) {
      setTimeRemaining(data.scenario.timeLimit);
      setShowResponses(false);
      setCurrentResponses([]);
    }
  };

  const handleResponseSubmitted = (data: { roomId: string; playerId: string; response: PlayerResponse }) => {
    if (data.roomId === roomId) {
      addChatMessage({
        id: `response_${Date.now()}`,
        playerId: 'system',
        username: 'System',
        message: `${room?.players.find(p => p.id === data.playerId)?.username || 'A player'} submitted their response`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleScenarioCompleted = (data: { roomId: string; results: PlayerResponse[] }) => {
    if (data.roomId === roomId) {
      setCurrentResponses(data.results);
      setShowResponses(true);
      setTimeRemaining(undefined);
    }
  };

  const handlePlayerMoved = (data: { roomId: string; playerId: string; position: any }) => {
    // Update player position in room state
    if (data.roomId === roomId && room) {
      const updatedRoom = {
        ...room,
        players: room.players.map(player => 
          player.id === data.playerId 
            ? { ...player, position: data.position }
            : player
        )
      };
      setRoom(updatedRoom);
    }
  };

  const handleGameFinished = (data: { roomId: string; winner: MultiplayerPlayer; finalResults: MultiplayerPlayer[] }) => {
    if (data.roomId === roomId) {
      addChatMessage({
        id: `winner_${Date.now()}`,
        playerId: 'system',
        username: 'System',
        message: `🏆 ${data.winner.username} wins the game!`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleChatMessage = (data: { roomId: string; playerId: string; message: string; timestamp: string; username: string }) => {
    if (data.roomId === roomId) {
      const messageId = `chat_${data.timestamp}_${data.playerId}_${data.message}`;
      
      // Check if message already exists (deduplication with more specific ID)
      const exists = chatMessages.find(msg => msg.id === messageId);
      if (!exists) {
        addChatMessage({
          id: messageId,
          playerId: data.playerId,
          username: data.username,
          message: data.message,
          timestamp: data.timestamp
        });
      }
    }
  };

  const handleError = (data: { message: string }) => {
    setError(data.message);
  };

  const addChatMessage = (message: ChatMessage) => {
    setChatMessages(prev => [...prev.slice(-49), message]); // Keep last 50 messages
  };

  // Actions
  const handleLeaveRoom = async () => {
    try {
      await multiplayerService.leaveRoom();
      onLeaveRoom();
    } catch (err) {
      console.error('Failed to leave room:', err);
      onLeaveRoom(); // Leave anyway
    }
  };

  const handleToggleReady = async () => {
    try {
      const newReadyState = !isReady;
      await multiplayerService.setReady(newReadyState);
      setIsReady(newReadyState);
    } catch (err) {
      setError('Failed to update ready state');
    }
  };

  const handleStartGame = async () => {
    try {
      await multiplayerService.startGame();
    } catch (err) {
      setError('Failed to start game');
    }
  };

  const handleSubmitResponse = async (response: string) => {
    try {
      await multiplayerService.submitResponse(response);
    } catch (err) {
      setError('Failed to submit response');
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || sendingMessage) return;

    const messageText = chatInput.trim();
    setSendingMessage(true);
    
    try {
      // Optimistically add the message to UI immediately
      const optimisticMessage: ChatMessage = {
        id: `temp_${Date.now()}_${currentPlayer?.id}`,
        playerId: currentPlayer?.id || 'unknown',
        username: currentPlayer?.username || 'You',
        message: messageText,
        timestamp: new Date().toISOString()
      };
      
      addChatMessage(optimisticMessage);
      setChatInput('');
      
      // Send to server
      await multiplayerService.sendChatMessage(messageText);
    } catch (err) {
      setError('Failed to send message');
      // Remove the optimistic message on error
      setChatMessages(prev => prev.filter(msg => !msg.id.startsWith('temp_')));
    } finally {
      setSendingMessage(false);
    }
  };

  const isHost = currentPlayer?.id === room?.hostId;
  const canStartGame = isHost && room?.players.every(p => p.isReady) && room?.players.length >= 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Room not found</h2>
          <button
            onClick={onLeaveRoom}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950">
      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <div className="p-4 bg-black/20 backdrop-blur-lg border-b border-white/20">
          <div className="flex items-center justify-between">
            <button
              onClick={handleLeaveRoom}
              className="bg-red-500/80 text-white px-3 py-2 rounded-lg text-sm"
            >
              Leave
            </button>
            <h1 className="text-lg font-bold text-white truncate mx-4">{room.name}</h1>
            <button
              onClick={() => setShowChat(!showChat)}
              className="bg-blue-500/80 text-white px-3 py-2 rounded-lg text-sm"
            >
              Chat
            </button>
          </div>
        </div>

        {/* Mobile Game Area */}
        <div className="p-4">
          {room.gameState === 'waiting' ? (
            <div className="space-y-4">
              {/* Player List */}
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                <h3 className="text-white font-bold mb-3">Players ({room.players.length}/{room.maxPlayers})</h3>
                <div className="space-y-2">
                  {room.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                          style={{ backgroundColor: player.avatar.color }}
                        >
                          {player.avatar.emoji}
                        </div>
                        <span className="text-white">{player.username}</span>
                        {player.id === room.hostId && (
                          <span className="bg-yellow-500/30 text-yellow-200 px-2 py-1 rounded text-xs">Host</span>
                        )}
                      </div>
                      <div className="text-sm">
                        {player.isReady ? (
                          <span className="text-green-400">✓ Ready</span>
                        ) : (
                          <span className="text-gray-400">Not Ready</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ready/Start Controls */}
              <div className="space-y-3">
                <button
                  onClick={handleToggleReady}
                  className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                    isReady 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                >
                  {isReady ? '✓ Ready' : 'Not Ready'}
                </button>

                {isHost && (
                  <button
                    onClick={handleStartGame}
                    disabled={!canStartGame}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-bold transition-colors"
                  >
                    {canStartGame ? 'Start Game' : 
                     room?.players.length === 1 ? 'Mark yourself ready to start' :
                     'Waiting for all players to be ready'}
                  </button>
                )}
              </div>
            </div>
          ) : room.gameState === 'starting' ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-white">
                <div className="text-6xl mb-4 animate-bounce">🚀</div>
                <h2 className="text-2xl font-bold mb-2">Game Starting!</h2>
                <p className="text-purple-200">Get ready for the first scenario...</p>
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Minimap */}
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                <MultiplayerMinimap room={room} />
              </div>

              {/* Current Scenario */}
              {room.currentScenario && room.gameState === 'playing' && (
                <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                  <h3 className="text-white font-bold mb-2">Current Scenario</h3>
                  <p className="text-gray-200 text-sm mb-4">{room.currentScenario.content}</p>
                  
                  <VoiceResponseInput
                    onSubmit={handleSubmitResponse}
                    timeLeft={timeRemaining}
                    placeholder="What would you do in this situation?"
                    disabled={room.gameState !== 'playing'}
                  />
                </div>
              )}

              {/* Response Review */}
              {showResponses && (
                <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                  <h3 className="text-white font-bold mb-4">Player Responses</h3>
                  <div className="space-y-4">
                    {currentResponses.map((response, index) => {
                      const player = room.players.find(p => p.responses.some(r => r.scenarioId === response.scenarioId));
                      return (
                        <div key={index} className="bg-white/10 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                              style={{ backgroundColor: player?.avatar.color }}
                            >
                              {player?.avatar.emoji}
                            </div>
                            <span className="text-white font-semibold">{player?.username}</span>
                            <span className="text-yellow-400 font-bold">Score: {response.score}</span>
                          </div>
                          <p className="text-gray-200 text-sm mb-2">{response.response}</p>
                          <p className="text-blue-200 text-xs italic">{response.aiAnalysis}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Chat Overlay */}
        {showChat && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
            <div className="p-4 bg-black/40 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold">Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="text-blue-300 font-semibold">{msg.username}:</span>
                  <span className="text-white ml-2">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 bg-black/40 border-t border-white/20">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Type a message..."
                  className="flex-1 p-2 bg-white/20 border border-white/30 rounded text-white placeholder-gray-400"
                />
                <button
                  onClick={handleSendChat}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex h-screen">
        {/* Left Sidebar - Room Info */}
        <div className="w-80 bg-black/20 backdrop-blur-lg border-r border-white/20 flex flex-col">
          {/* Room Header */}
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-bold text-white truncate">{room.name}</h1>
              <button
                onClick={handleLeaveRoom}
                className="bg-red-500/80 hover:bg-red-600/80 text-white px-3 py-2 rounded text-sm"
              >
                Leave
              </button>
            </div>
            <p className="text-purple-200 text-sm">
              {room.gameState === 'waiting' ? 'Waiting for players' : 'Game in progress'}
            </p>
          </div>

          {/* Players List */}
          <div className="p-4 border-b border-white/20">
            <h3 className="text-white font-bold mb-3">Players ({room.players.length}/{room.maxPlayers})</h3>
            <div className="space-y-2">
              {room.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: player.avatar.color }}
                    >
                      {player.avatar.emoji}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{player.username}</div>
                      {player.id === room.hostId && (
                        <div className="bg-yellow-500/30 text-yellow-200 px-2 py-1 rounded text-xs">Host</div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm">
                    {player.isReady ? (
                      <span className="text-green-400">✓ Ready</span>
                    ) : (
                      <span className="text-gray-400">Not Ready</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Controls */}
          {room.gameState === 'waiting' && (
            <div className="p-4 space-y-3">
              <button
                onClick={handleToggleReady}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                  isReady 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {isReady ? '✓ Ready' : 'Not Ready'}
              </button>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={!canStartGame}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-bold transition-colors"
                >
                  {canStartGame ? 'Start Game' : 'Waiting for all players'}
                </button>
              )}
            </div>
          )}

          {/* Chat */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-white/20">
              <h3 className="text-white font-bold">Chat</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="text-blue-300 font-semibold">{msg.username}:</span>
                  <span className="text-white ml-2">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 border-t border-white/20">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Type a message..."
                  className="flex-1 p-2 bg-white/20 border border-white/30 rounded text-white placeholder-gray-400 text-sm"
                />
                <button
                  onClick={handleSendChat}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="flex-1 flex flex-col">
          {/* Game Content */}
          <div className="flex-1 p-6">
            {room.gameState === 'waiting' ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-6xl mb-4">🎮</div>
                  <h2 className="text-2xl font-bold mb-2">Waiting for Game to Start</h2>
                  <p className="text-purple-200">
                    {room.players.length === 1 
                      ? 'Ready to start your solo test game!' 
                      : 'All players must be ready before the host can start the game'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col gap-6">
                {/* Minimap */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <MultiplayerMinimap room={room} />
                </div>

                {/* Current Scenario */}
                {room.currentScenario && room.gameState === 'playing' && (
                  <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                    <h3 className="text-white font-bold text-xl mb-4">Current Scenario</h3>
                    <p className="text-gray-200 mb-6">{room.currentScenario.content}</p>
                    
                    <VoiceResponseInput
                      onSubmit={handleSubmitResponse}
                      timeLeft={timeRemaining}
                      placeholder="What would you do in this situation?"
                      disabled={room.gameState !== 'playing'}
                    />
                  </div>
                )}

                {/* Response Review */}
                {showResponses && (
                  <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                    <h3 className="text-white font-bold text-xl mb-6">Player Responses</h3>
                    <div className="grid gap-4">
                      {currentResponses.map((response, index) => {
                        const player = room.players.find(p => p.responses.some(r => r.scenarioId === response.scenarioId));
                        return (
                          <div key={index} className="bg-white/10 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: player?.avatar.color }}
                              >
                                {player?.avatar.emoji}
                              </div>
                              <span className="text-white font-semibold text-lg">{player?.username}</span>
                              <span className="text-yellow-400 font-bold text-lg">Score: {response.score}</span>
                            </div>
                            <p className="text-gray-200 mb-3">{response.response}</p>
                            <p className="text-blue-200 italic">{response.aiAnalysis}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500/90 text-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};