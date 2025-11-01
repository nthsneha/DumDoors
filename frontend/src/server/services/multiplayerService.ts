import { redis, settings } from '@devvit/web/server';
import type {
  MultiplayerRoom,
  MultiplayerPlayer,
  CreateRoomRequest,
  RoomListItem,
  PlayerAvatar
} from '../../shared/types/multiplayer';

class MultiplayerService {
  private readonly ROOM_PREFIX = 'mp_room:';
  private readonly ROOM_LIST_KEY = 'mp_rooms';
  private readonly PLAYER_SESSION_PREFIX = 'mp_session:';
  private readonly settings = settings;

  // Helper methods
  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private getRandomAvatar(): PlayerAvatar {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const emojis = ['🚀', '🎮', '🎯', '⚡', '🔥', '💎', '🌟', '🎪'];
    const trails = ['✨', '💫', '⭐', '🌈', '💥', '🎊', '🎉', '✴️'];

    return {
      color: colors[Math.floor(Math.random() * colors.length)] || '#4ECDC4',
      emoji: emojis[Math.floor(Math.random() * emojis.length)] || '🎮',
      trail: trails[Math.floor(Math.random() * trails.length)] || '✨'
    };
  }

  private createPlayer(username: string): MultiplayerPlayer {
    return {
      id: this.generatePlayerId(),
      username,
      avatar: this.getRandomAvatar(),
      position: {
        x: 0,
        y: 50,
        currentDoor: 0,
        pathLength: 5,
        isMoving: false,
        movementSpeed: 1
      },
      totalScore: 0,
      responses: [],
      isReady: false,
      isConnected: true,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
  }

  // Room management
  async createRoom(request: CreateRoomRequest, hostUsername: string): Promise<{ room: MultiplayerRoom; playerId: string }> {
    const roomId = this.generateRoomId();
    const hostPlayer = this.createPlayer(hostUsername);

    const room: MultiplayerRoom = {
      id: roomId,
      name: request.name,
      hostId: hostPlayer.id,
      hostUsername,
      players: [hostPlayer],
      maxPlayers: request.maxPlayers,
      gameState: 'waiting',
      settings: request.settings,
      createdAt: new Date().toISOString(),
      isPrivate: request.isPrivate,
      ...(request.isPrivate && request.password && { password: request.password })
    };

    // Store room in Redis
    await redis.set(`${this.ROOM_PREFIX}${roomId}`, JSON.stringify(room));

    // Store room in room list (simple key-value approach)
    const roomList = await redis.get(this.ROOM_LIST_KEY) || '[]';
    const rooms = JSON.parse(roomList);
    rooms.push(roomId);
    await redis.set(this.ROOM_LIST_KEY, JSON.stringify(rooms));

    // Store player session
    await redis.set(`${this.PLAYER_SESSION_PREFIX}${hostPlayer.id}`, JSON.stringify({
      playerId: hostPlayer.id,
      roomId,
      username: hostUsername
    }));

    console.log(`🎮 [MULTIPLAYER] Room created: ${roomId} by ${hostUsername}`);
    return { room, playerId: hostPlayer.id };
  }

  async joinRoom(roomId: string, username: string, password?: string): Promise<{ room: MultiplayerRoom; playerId: string }> {
    const roomData = await redis.get(`${this.ROOM_PREFIX}${roomId}`);
    if (!roomData) {
      throw new Error('Room not found');
    }

    const room: MultiplayerRoom = JSON.parse(roomData);

    // Check if room is full
    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    // Check password for private rooms
    if (room.isPrivate && room.password !== password) {
      throw new Error('Invalid password');
    }

    // Check if player already exists
    const existingPlayer = room.players.find(p => p.username === username);
    if (existingPlayer) {
      // Reconnect existing player
      await redis.set(`${this.PLAYER_SESSION_PREFIX}${existingPlayer.id}`, JSON.stringify({
        playerId: existingPlayer.id,
        roomId,
        username
      }));
      return { room, playerId: existingPlayer.id };
    }

    // Add new player
    const newPlayer = this.createPlayer(username);
    room.players.push(newPlayer);

    // Update room in Redis
    await redis.set(`${this.ROOM_PREFIX}${roomId}`, JSON.stringify(room));

    // Store player session
    await redis.set(`${this.PLAYER_SESSION_PREFIX}${newPlayer.id}`, JSON.stringify({
      playerId: newPlayer.id,
      roomId,
      username
    }));

    console.log(`🎮 [MULTIPLAYER] Player ${username} joined room ${roomId}`);
    return { room, playerId: newPlayer.id };
  }

  async leaveRoom(roomId: string, username: string): Promise<void> {
    const roomData = await redis.get(`${this.ROOM_PREFIX}${roomId}`);
    if (!roomData) {
      return;
    }

    const room: MultiplayerRoom = JSON.parse(roomData);
    const playerIndex = room.players.findIndex(p => p.username === username);

    if (playerIndex === -1) {
      return;
    }

    const player = room.players[playerIndex];
    if (!player) return;

    room.players.splice(playerIndex, 1);

    // Remove player session
    await redis.del(`${this.PLAYER_SESSION_PREFIX}${player.id}`);

    if (room.players.length === 0) {
      // Clean up empty room
      await redis.del(`${this.ROOM_PREFIX}${roomId}`);

      // Remove from room list
      const roomListData = await redis.get(this.ROOM_LIST_KEY) || '[]';
      const roomIds = JSON.parse(roomListData);
      const updatedRoomIds = roomIds.filter((id: string) => id !== roomId);
      await redis.set(this.ROOM_LIST_KEY, JSON.stringify(updatedRoomIds));

      console.log(`🎮 [MULTIPLAYER] Room ${roomId} cleaned up (empty)`);
    } else {
      // If host left, assign new host
      const leavingPlayer = room.players.find(p => p.username === username);
      if (leavingPlayer && leavingPlayer.id === room.hostId && room.players.length > 0) {
        const newHost = room.players[0];
        if (newHost) {
          room.hostId = newHost.id;
          room.hostUsername = newHost.username;
        }
      }

      // Update room
      await redis.set(`${this.ROOM_PREFIX}${roomId}`, JSON.stringify(room));
    }

    console.log(`🎮 [MULTIPLAYER] Player ${username} left room ${roomId}`);
  }

  async getRoomList(): Promise<RoomListItem[]> {
    const roomListData = await redis.get(this.ROOM_LIST_KEY) || '[]';
    const roomIds = JSON.parse(roomListData);
    const rooms: RoomListItem[] = [];

    for (const roomId of roomIds) {
      const roomData = await redis.get(`${this.ROOM_PREFIX}${roomId}`);
      if (roomData) {
        const room: MultiplayerRoom = JSON.parse(roomData);

        // Only show public rooms or private rooms in waiting state
        if (!room.isPrivate || room.gameState === 'waiting') {
          rooms.push({
            id: room.id,
            name: room.name,
            hostUsername: room.hostUsername,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            gameState: room.gameState,
            isPrivate: room.isPrivate,
            createdAt: room.createdAt
          });
        }
      }
    }

    // Sort by creation time (newest first)
    return rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRoom(roomId: string): Promise<MultiplayerRoom | null> {
    const roomData = await redis.get(`${this.ROOM_PREFIX}${roomId}`);
    return roomData ? JSON.parse(roomData) : null;
  }

  async updateRoom(room: MultiplayerRoom): Promise<void> {
    await redis.set(`${this.ROOM_PREFIX}${room.id}`, JSON.stringify(room));
  }

  async setPlayerReady(roomId: string, username: string, isReady: boolean): Promise<MultiplayerRoom | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const player = room.players.find(p => p.username === username);
    if (!player) return null;

    player.isReady = isReady;
    await this.updateRoom(room);

    return room;
  }

  async startGame(roomId: string, hostUsername: string): Promise<MultiplayerRoom | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    // Check if user is host
    if (room.hostUsername !== hostUsername) {
      throw new Error('Only host can start game');
    }

    // Check if all players are ready
    if (!room.players.every(p => p.isReady)) {
      throw new Error('Not all players are ready');
    }

    // Check minimum players (allow 1 for testing)
    if (room.players.length < 1) {
      throw new Error('Not enough players');
    }

    // Start game with countdown
    room.gameState = 'starting';
    await this.updateRoom(room);

    // Generate first Halloween scenario
    const scenarios = [
      "You're at a Halloween costume party dressed as a ghost, and you accidentally walk into a real séance in the basement where everyone thinks you're the summoned spirit they've been trying to contact for an hour.",
      "You're trick-or-treating and accidentally walk into someone's actual funeral reception thinking it's a haunted house. You compliment the \"realistic crying.\"",
      "Your fake vampire fangs get stuck to your real teeth right before an important job interview and you have to lisp through \"team player\" and \"synergy.\"",
      "You carved a pumpkin that looks exactly like your neighbor's angry face and they're now convinced you're planning something sinister.",
      "You're wearing a full-body inflatable dinosaur costume and get stuck in a revolving door. A crowd gathers. Someone starts a TikTok livestream."
    ];

    room.currentScenario = {
      id: `scenario_${Date.now().toString()}`,
      content: scenarios[Math.floor(Math.random() * scenarios.length)] || "A mysterious situation unfolds before you. What do you do?",
      reasoning: "This scenario tests decision-making under pressure.",
      difficulty: 1,
      timeLimit: room.settings.timePerScenario
    };

    room.scenarioStartTime = Date.now();

    // Transition to playing state after a short delay
    setTimeout(async () => {
      room.gameState = 'playing';
      await this.updateRoom(room);
      console.log(`🎮 [MULTIPLAYER] Game transitioned to playing state in room ${roomId}`);
    }, 3000); // 3 second countdown

    await this.updateRoom(room);
    console.log(`🎮 [MULTIPLAYER] Game starting in room ${roomId}`);
    return room;
  }

  async submitResponse(roomId: string, username: string, response: string): Promise<MultiplayerRoom | null> {
    const room = await this.getRoom(roomId);
    if (!room || room.gameState !== 'playing') return null;

    const player = room.players.find(p => p.username === username);
    if (!player || !room.currentScenario) return null;

    // Generate AI analysis and scoring
    const { score, aiAnalysis } = await this.generateAIResponse(response, room.currentScenario.content);

    const playerResponse = {
      scenarioId: room.currentScenario.id,
      response,
      score,
      submittedAt: new Date().toISOString(),
      aiAnalysis,
      pathAdjustment: score > 70 ? -1 : score < 30 ? 1 : 0
    };

    player.responses.push(playerResponse);
    player.totalScore += score;

    // Update player position
    if (playerResponse.pathAdjustment !== 0) {
      player.position.pathLength = Math.max(3, Math.min(10, player.position.pathLength + playerResponse.pathAdjustment));
    }
    player.position.currentDoor++;
    player.position.x = (player.position.currentDoor / 10) * 100;

    await this.updateRoom(room);

    // Check if all players have responded
    const currentScenarioId = room.currentScenario.id;
    const allResponded = room.players.every(p =>
      p.responses.some(r => r.scenarioId === currentScenarioId)
    );

    if (allResponded) {
      room.gameState = 'reviewing';
      await this.updateRoom(room);

      // Auto-transition from reviewing to racing after 5 seconds
      setTimeout(async () => {
        const updatedRoom = await this.getRoom(roomId);
        if (updatedRoom && updatedRoom.gameState === 'reviewing') {
          updatedRoom.gameState = 'racing';
          await this.updateRoom(updatedRoom);
          console.log(`🏁 [MULTIPLAYER] Room ${roomId} transitioned to racing state`);

          // Auto-transition from racing to next scenario or finished after 4 seconds
          setTimeout(async () => {
            const racingRoom = await this.getRoom(roomId);
            if (racingRoom && racingRoom.gameState === 'racing') {
              await this.progressToNextScenario(roomId);
            }
          }, 4000);
        }
      }, 5000);
    }

    return room;
  }

  async sendChatMessage(roomId: string, username: string, message: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;

    const player = room.players.find(p => p.username === username);
    if (!player) return false;

    if (message.length > 200) {
      throw new Error('Message too long');
    }

    // Store chat message in Redis (simple approach)
    const chatKey = `mp_chat:${roomId}`;
    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      playerId: player.id,
      username,
      message,
      timestamp: new Date().toISOString()
    };

    // Get existing messages
    const existingMessages = await redis.get(chatKey) || '[]';
    const messages = JSON.parse(existingMessages);

    // Add new message and keep only last 50
    messages.push(chatMessage);
    if (messages.length > 50) {
      messages.splice(0, messages.length - 50);
    }

    // Store back
    await redis.set(chatKey, JSON.stringify(messages));
    await redis.expire(chatKey, 3600); // Expire after 1 hour

    return true;
  }

  async getChatMessages(roomId: string): Promise<any[]> {
    const chatKey = `mp_chat:${roomId}`;
    const messagesData = await redis.get(chatKey) || '[]';
    return JSON.parse(messagesData);
  }

  async generateAIResponse(playerResponse: string, scenario: string): Promise<{ score: number; aiAnalysis: string }> {
    try {
      // Use direct Gemini API call like the normal game
      const geminiApiKey = await this.settings.get('geminiApiKey');

      if (!geminiApiKey) {
        console.log('🚨 [MULTIPLAYER] No Gemini API key configured, using fallback');
        return this.generateFallbackResponse(playerResponse);
      }

      const prompt = `You are an AI judge for "DumDoors" multiplayer game. Analyze this response and create a funny, exaggerated outcome.

SCENARIO: ${scenario}
PLAYER RESPONSE: "${playerResponse}"

SCORING (0-100):
- 90-100: Brilliant, genius-level response
- 70-89: Smart, creative, would work well
- 50-69: Decent response, not bad
- 30-49: Poor choice, might cause problems
- 0-29: Terrible decision, disaster incoming

Create a SHORT but HILARIOUS outcome (2-3 sentences) that directly results from their specific response. Make it funny and exaggerated but not mean.

Respond with ONLY this JSON:
{
  "score": [number 0-100],
  "outcome": "[Funny 2-3 sentence result of their choice]"
}`;

      // Try multiple models with retry logic
      const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];

      for (const model of models) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              }
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json() as any;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
              const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
              const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

              if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                return {
                  score: Math.max(10, Math.min(100, analysis.score || 50)),
                  aiAnalysis: analysis.outcome || "Your response shows thoughtful consideration."
                };
              }
            }
          }
        } catch (error) {
          console.log(`🚨 [MULTIPLAYER] Model ${model} failed:`, error);
          continue;
        }
      }

      // All models failed, use fallback
      console.log('🚨 [MULTIPLAYER] All Gemini models failed, using fallback scoring');
      return this.generateFallbackResponse(playerResponse);

    } catch (error) {
      console.error('🚨 [MULTIPLAYER] Error calling Gemini API:', error);
      return this.generateFallbackResponse(playerResponse);
    }
  }

  private generateFallbackResponse(playerResponse: string): { score: number; aiAnalysis: string } {
    // Simple fallback scoring based on response characteristics
    const responseLength = playerResponse.trim().length;
    const hasAction = /\b(go|run|walk|take|grab|use|open|close|call|help|ask|tell|say|do|try|attempt|choose|pick|select)\b/i.test(playerResponse);
    const hasReasoning = /\b(because|since|so|therefore|thus|reason|think|believe|feel|should|would|could|might)\b/i.test(playerResponse);

    let score = 30;

    if (responseLength > 20) score += 20;
    if (responseLength > 50) score += 15;
    if (hasAction) score += 20;
    if (hasReasoning) score += 15;

    // Add some randomness
    score += Math.floor(Math.random() * 20) - 10;
    score = Math.max(10, Math.min(100, score));

    const feedback = score > 70 ? "Excellent decision-making!" :
      score > 50 ? "Good thinking!" :
        score > 30 ? "Decent approach." :
          "Questionable choice.";

    return { score, aiAnalysis: feedback };
  }

  async progressToNextScenario(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;

    // Check if game should end (after 5 scenarios or someone reached door 10)
    const maxDoor = Math.max(...room.players.map(p => p.position.currentDoor));
    const scenarioCount = room.players[0]?.responses.length || 0;

    if (maxDoor >= 10 || scenarioCount >= 5) {
      // Game finished
      room.gameState = 'finished';

      // Determine winner (highest score, or furthest door if tied)
      const sortedPlayers = [...room.players].sort((a, b) => {
        if (a.position.currentDoor !== b.position.currentDoor) {
          return b.position.currentDoor - a.position.currentDoor;
        }
        return b.totalScore - a.totalScore;
      });

      if (sortedPlayers.length > 0) {
        const winner = sortedPlayers[0];
        if (winner) {
          room.winner = winner;
          console.log(`🏆 [MULTIPLAYER] Game finished in room ${roomId}. Winner: ${winner.username}`);
        }
      }
    } else {
      // Generate next Halloween scenario
      const scenarios = [
        "You're at a Halloween costume party dressed as a ghost, and you accidentally walk into a real séance in the basement where everyone thinks you're the summoned spirit they've been trying to contact for an hour.",
        "You're trick-or-treating and accidentally walk into someone's actual funeral reception thinking it's a haunted house. You compliment the \"realistic crying.\"",
        "Your fake vampire fangs get stuck to your real teeth right before an important job interview and you have to lisp through \"team player\" and \"synergy.\"",
        "You carved a pumpkin that looks exactly like your neighbor's angry face and they're now convinced you're planning something sinister.",
        "You're wearing a full-body inflatable dinosaur costume and get stuck in a revolving door. A crowd gathers. Someone starts a TikTok livestream.",
        "Your \"sexy cat\" costume rips completely at the back while you're bending over to judge a children's costume contest. Parents shield their kids' eyes.",
        "You accidentally used permanent black hair dye instead of temporary spray for your witch costume. Your wedding is tomorrow and you're supposed to be a blonde bride.",
        "You're dressed as a mummy and your bandages start unraveling on a crowded subway. By your stop, you're just standing there in your underwear holding a pile of toilet paper.",
        "Your elaborate zombie makeup is so realistic that a Karen calls 911, an ambulance arrives, and the paramedics are annoyed they can't bill you.",
        "You bought 20 bags of candy for trick-or-treaters but stress-ate it all by October 30th. Now 50 kids are at your door and you're handing out loose granola bars and coins."
      ];

      room.currentScenario = {
        id: `scenario_${Date.now().toString()}`,
        content: scenarios[Math.floor(Math.random() * scenarios.length)] || "A mysterious situation unfolds before you. What do you do?",
        reasoning: "This scenario tests decision-making under pressure.",
        difficulty: Math.min(3, Math.floor(scenarioCount / 2) + 1),
        timeLimit: room.settings.timePerScenario
      };

      room.scenarioStartTime = Date.now();
      room.gameState = 'playing';
      console.log(`🎮 [MULTIPLAYER] New scenario started in room ${roomId}`);
    }

    await this.updateRoom(room);
  }

  // Cleanup old rooms periodically
  async cleanupOldRooms(): Promise<void> {
    const roomListData = await redis.get(this.ROOM_LIST_KEY) || '[]';
    const roomIds = JSON.parse(roomListData);
    const now = Date.now();
    const cleanupTime = 30 * 60 * 1000; // 30 minutes
    const activeRoomIds: string[] = [];

    for (const roomId of roomIds) {
      const roomData = await redis.get(`${this.ROOM_PREFIX}${roomId}`);
      if (roomData) {
        const room: MultiplayerRoom = JSON.parse(roomData);
        const roomAge = now - new Date(room.createdAt).getTime();

        // Clean up rooms older than 30 minutes with no activity
        if (roomAge > cleanupTime) {
          await redis.del(`${this.ROOM_PREFIX}${roomId}`);

          // Clean up player sessions
          for (const player of room.players) {
            await redis.del(`${this.PLAYER_SESSION_PREFIX}${player.id}`);
          }

          console.log(`🎮 [MULTIPLAYER] Cleaned up old room: ${roomId}`);
        } else {
          activeRoomIds.push(roomId);
        }
      }
    }

    // Update room list with only active rooms
    await redis.set(this.ROOM_LIST_KEY, JSON.stringify(activeRoomIds));
  }
}

export const multiplayerService = new MultiplayerService();