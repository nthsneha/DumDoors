// Multiplayer Service - WebSocket and API management
import type { 
  MultiplayerRoom, 
  CreateRoomRequest, 
  JoinRoomRequest,
  RoomListItem
} from '../../shared/types/multiplayer';

class MultiplayerService {
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private currentRoomId: string | null = null;
  private playerId: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastRoomState: MultiplayerRoom | null = null;
  private lastChatMessages: Set<string> = new Set(); // Track seen chat message IDs

  // Initialize polling-based connection (Devvit compatible)
  connect(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🎮 [MULTIPLAYER] Starting polling-based multiplayer (Devvit compatible)');
      resolve();
    });
  }

  // Stop polling and disconnect
  disconnect(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.currentRoomId = null;
    this.playerId = null;
    this.lastRoomState = null;
    this.lastChatMessages.clear();
    console.log('🎮 [MULTIPLAYER] Disconnected from polling service');
  }

  // Start polling for room updates
  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    let chatPollCounter = 0;

    this.pollingInterval = setInterval(async () => {
      if (this.currentRoomId) {
        try {
          // Poll room state every cycle
          const room = await this.getCurrentRoom();
          if (room) {
            this.checkForRoomChanges(room);
          }

          // Poll chat messages less frequently (every 4 seconds instead of 2)
          chatPollCounter++;
          if (chatPollCounter >= 2) {
            await this.pollChatMessages();
            chatPollCounter = 0;
          }
        } catch (error) {
          console.error('🎮 [MULTIPLAYER] Polling error:', error);
        }
      }
    }, 2000); // Poll every 2 seconds, but chat every 4 seconds
  }

  // Poll for new chat messages
  private async pollChatMessages(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/multiplayer/rooms/${this.currentRoomId}/chat`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          // Only emit new messages we haven't seen before
          data.messages.forEach((msg: any) => {
            const messageId = `${msg.timestamp}_${msg.playerId}_${msg.message}`;
            
            if (!this.lastChatMessages.has(messageId)) {
              this.lastChatMessages.add(messageId);
              
              // Keep only last 100 message IDs to prevent memory leak
              if (this.lastChatMessages.size > 100) {
                const messagesArray = Array.from(this.lastChatMessages);
                this.lastChatMessages.clear();
                messagesArray.slice(-50).forEach(id => this.lastChatMessages.add(id));
              }
              
              this.emit('chat_message', {
                roomId: this.currentRoomId,
                playerId: msg.playerId,
                message: msg.message,
                timestamp: msg.timestamp,
                username: msg.username
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to poll chat:', error);
    }
  }

  // Check for changes in room state and emit events
  private checkForRoomChanges(newRoom: MultiplayerRoom): void {
    if (!this.lastRoomState) {
      this.lastRoomState = newRoom;
      this.emit('room_updated', newRoom);
      return;
    }

    const oldRoom = this.lastRoomState;

    // Check for new players
    newRoom.players.forEach(player => {
      const existed = oldRoom.players.find(p => p.id === player.id);
      if (!existed) {
        this.emit('player_joined', { roomId: newRoom.id, player });
      }
    });

    // Check for removed players
    oldRoom.players.forEach(player => {
      const stillExists = newRoom.players.find(p => p.id === player.id);
      if (!stillExists) {
        this.emit('player_left', { roomId: newRoom.id, playerId: player.id });
      }
    });

    // Check for game state changes
    if (oldRoom.gameState !== newRoom.gameState) {
      if (newRoom.gameState === 'playing' && newRoom.currentScenario) {
        this.emit('game_started', { roomId: newRoom.id, scenario: newRoom.currentScenario });
      } else if (newRoom.gameState === 'reviewing') {
        // Get all responses for current scenario
        const currentScenarioId = newRoom.currentScenario?.id;
        if (currentScenarioId) {
          const responses = newRoom.players.map(p => 
            p.responses.find(r => r.scenarioId === currentScenarioId)
          ).filter(Boolean);
          this.emit('scenario_completed', { roomId: newRoom.id, results: responses });
        }
      } else if (newRoom.gameState === 'finished') {
        const winner = newRoom.players.reduce((prev, current) => 
          prev.totalScore > current.totalScore ? prev : current
        );
        this.emit('game_finished', { roomId: newRoom.id, winner, finalResults: newRoom.players });
      }
    }

    // Check for player position changes
    newRoom.players.forEach(player => {
      const oldPlayer = oldRoom.players.find(p => p.id === player.id);
      if (oldPlayer && (oldPlayer.position.x !== player.position.x || oldPlayer.position.y !== player.position.y)) {
        this.emit('player_moved', { roomId: newRoom.id, playerId: player.id, position: player.position });
      }
    });

    // Always emit room update
    this.emit('room_updated', newRoom);
    this.lastRoomState = newRoom;
  }



  // Event listener management
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // API Methods

  // Get list of available rooms
  async getRoomList(): Promise<RoomListItem[]> {
    try {
      const response = await fetch('/api/multiplayer/rooms');
      if (!response.ok) throw new Error('Failed to fetch rooms');
      const data = await response.json();
      return data.rooms || [];
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to get room list:', error);
      throw error;
    }
  }

  // Create a new room
  async createRoom(request: CreateRoomRequest): Promise<MultiplayerRoom> {
    try {
      const response = await fetch('/api/multiplayer/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) throw new Error('Failed to create room');
      const data = await response.json();
      
      this.currentRoomId = data.room.id;
      this.playerId = data.playerId;
      
      // Start polling for room updates
      this.startPolling();
      
      return data.room;
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to create room:', error);
      throw error;
    }
  }

  // Join an existing room
  async joinRoom(request: JoinRoomRequest): Promise<MultiplayerRoom> {
    try {
      const response = await fetch(`/api/multiplayer/rooms/${request.roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: request.password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join room');
      }
      
      const data = await response.json();
      this.currentRoomId = data.room.id;
      this.playerId = data.playerId;
      
      // Start polling for room updates
      this.startPolling();
      
      return data.room;
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to join room:', error);
      throw error;
    }
  }

  // Leave current room
  async leaveRoom(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      await fetch(`/api/multiplayer/rooms/${this.currentRoomId}/leave`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to leave room:', error);
    } finally {
      // Stop polling
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
      this.currentRoomId = null;
      this.playerId = null;
      this.lastRoomState = null;
      this.lastChatMessages.clear();
    }
  }

  // Start the game (host only)
  async startGame(): Promise<void> {
    if (!this.currentRoomId) throw new Error('Not in a room');

    try {
      const response = await fetch(`/api/multiplayer/rooms/${this.currentRoomId}/start`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start game');
      }
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to start game:', error);
      throw error;
    }
  }

  // Submit response to current scenario
  async submitResponse(response: string): Promise<void> {
    if (!this.currentRoomId) throw new Error('Not in a room');

    try {
      const apiResponse = await fetch(`/api/multiplayer/rooms/${this.currentRoomId}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });

      if (!apiResponse.ok) throw new Error('Failed to submit response');
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to submit response:', error);
      throw error;
    }
  }

  // Send chat message
  async sendChatMessage(message: string): Promise<void> {
    if (!this.currentRoomId) throw new Error('Not in a room');

    try {
      const response = await fetch(`/api/multiplayer/rooms/${this.currentRoomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!response.ok) throw new Error('Failed to send message');
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to send chat message:', error);
      throw error;
    }
  }

  // Set player ready state
  async setReady(isReady: boolean): Promise<void> {
    if (!this.currentRoomId) throw new Error('Not in a room');

    try {
      const response = await fetch(`/api/multiplayer/rooms/${this.currentRoomId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReady })
      });

      if (!response.ok) throw new Error('Failed to set ready state');
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to set ready state:', error);
      throw error;
    }
  }

  // Get current room info
  async getCurrentRoom(): Promise<MultiplayerRoom | null> {
    if (!this.currentRoomId) return null;

    try {
      const response = await fetch(`/api/multiplayer/rooms/${this.currentRoomId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.room;
    } catch (error) {
      console.error('🎮 [MULTIPLAYER] Failed to get current room:', error);
      return null;
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.pollingInterval !== null;
  }

  get currentRoom(): string | null {
    return this.currentRoomId;
  }

  get currentPlayer(): string | null {
    return this.playerId;
  }
}

// Export singleton instance
export const multiplayerService = new MultiplayerService();