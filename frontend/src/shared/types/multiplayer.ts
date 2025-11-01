// Multiplayer Game Types
export interface MultiplayerRoom {
    id: string;
    name: string;
    hostId: string;
    hostUsername: string;
    players: MultiplayerPlayer[];
    maxPlayers: number;
    gameState: MultiplayerGameState;
    currentScenario?: GameScenario;
    scenarioStartTime?: number;
    settings: RoomSettings;
    createdAt: string;
    isPrivate: boolean;
    password?: string;
    winner?: MultiplayerPlayer;
}

export interface MultiplayerPlayer {
    id: string;
    username: string;
    redditUserId?: string;
    avatar: PlayerAvatar;
    position: PlayerPosition;
    totalScore: number;
    responses: PlayerResponse[];
    isReady: boolean;
    isConnected: boolean;
    joinedAt: string;
    lastSeen: string;
}

export interface PlayerAvatar {
    color: string;
    emoji: string;
    trail: string;
}

export interface PlayerPosition {
    x: number;
    y: number;
    currentDoor: number;
    pathLength: number;
    isMoving: boolean;
    movementSpeed: number;
}

export interface PlayerResponse {
    scenarioId: string;
    response: string;
    score: number;
    submittedAt: string;
    aiAnalysis: string;
    pathAdjustment: number;
}

export interface GameScenario {
    id: string;
    content: string;
    reasoning: string;
    difficulty: number;
    timeLimit: number;
}

export interface RoomSettings {
    maxPlayers: number;
    timePerScenario: number;
    totalScenarios: number;
    allowSpectators: boolean;
    showResponsesLive: boolean;
    enableVoiceChat: boolean;
    difficultyLevel: 'easy' | 'medium' | 'hard' | 'mixed';
}

export type MultiplayerGameState =
    | 'waiting'      // Waiting for players to join
    | 'starting'     // Game is about to start (countdown)
    | 'playing'      // Active gameplay
    | 'reviewing'    // Showing responses and AI analysis
    | 'racing'       // Avatar racing animation
    | 'finished'     // Game completed
    | 'paused';      // Game paused

export interface GameStateUpdate {
    roomId: string;
    gameState: MultiplayerGameState;
    currentScenario?: GameScenario;
    timeRemaining?: number;
    players: MultiplayerPlayer[];
    lastUpdate: string;
}

export interface RoomListItem {
    id: string;
    name: string;
    hostUsername: string;
    playerCount: number;
    maxPlayers: number;
    gameState: MultiplayerGameState;
    isPrivate: boolean;
    createdAt: string;
}

// WebSocket Events
export type MultiplayerEvent =
    | { type: 'room_created'; data: MultiplayerRoom }
    | { type: 'room_updated'; data: MultiplayerRoom }
    | { type: 'player_joined'; data: { roomId: string; player: MultiplayerPlayer } }
    | { type: 'player_left'; data: { roomId: string; playerId: string } }
    | { type: 'player_ready'; data: { roomId: string; playerId: string; isReady: boolean } }
    | { type: 'game_started'; data: { roomId: string; scenario: GameScenario } }
    | { type: 'response_submitted'; data: { roomId: string; playerId: string; response: PlayerResponse } }
    | { type: 'scenario_completed'; data: { roomId: string; results: PlayerResponse[] } }
    | { type: 'player_moved'; data: { roomId: string; playerId: string; position: PlayerPosition } }
    | { type: 'game_finished'; data: { roomId: string; winner: MultiplayerPlayer; finalResults: MultiplayerPlayer[] } }
    | { type: 'chat_message'; data: { roomId: string; playerId: string; message: string; timestamp: string } }
    | { type: 'error'; data: { message: string; code?: string } };

// API Request/Response Types
export interface CreateRoomRequest {
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
    settings: RoomSettings;
}

export interface JoinRoomRequest {
    roomId: string;
    password?: string;
}

export interface SubmitResponseRequest {
    roomId: string;
    response: string;
}

export interface ChatMessageRequest {
    roomId: string;
    message: string;
}

// Game Constants
export const MULTIPLAYER_CONSTANTS = {
    MIN_PLAYERS: 1, // Allow 1 for testing
    MAX_PLAYERS: 4,
    DEFAULT_TIME_PER_SCENARIO: 45, // seconds
    DEFAULT_TOTAL_SCENARIOS: 5,
    RACE_ANIMATION_DURATION: 3000, // milliseconds
    RESPONSE_REVIEW_TIME: 10000, // milliseconds
    ROOM_CLEANUP_TIME: 300000, // 5 minutes after last activity
    MAX_ROOM_NAME_LENGTH: 50,
    MAX_CHAT_MESSAGE_LENGTH: 200,
    AVATAR_COLORS: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ],
    AVATAR_EMOJIS: ['🚀', '🎮', '🎯', '⚡', '🔥', '💎', '🌟', '🎪'],
    AVATAR_TRAILS: ['✨', '💫', '⭐', '🌈', '💥', '🎊', '🎉', '✴️']
} as const;

export type AvatarColor = typeof MULTIPLAYER_CONSTANTS.AVATAR_COLORS[number];
export type AvatarEmoji = typeof MULTIPLAYER_CONSTANTS.AVATAR_EMOJIS[number];
export type AvatarTrail = typeof MULTIPLAYER_CONSTANTS.AVATAR_TRAILS[number];