export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

// Game-related types
export type GameMode = 'multiplayer' | 'single-player';

export type GameStatus = 'waiting' | 'active' | 'completed';

export interface PlayerInfo {
  playerId: string;
  username: string;
  redditUserId: string;
  joinedAt: string;
  currentPosition: number;
  totalScore: number;
  responses: PlayerResponse[];
  isActive: boolean;
}

export interface Door {
  doorId: string;
  content: string;
  theme: string;
  difficulty: number;
  expectedSolutionTypes: string[];
}

export interface PlayerResponse {
  responseId: string;
  doorId: string;
  playerId: string;
  content: string;
  aiScore: number;
  submittedAt: string;
  scoringMetrics: {
    creativity: number;
    feasibility: number;
    humor: number;
    originality: number;
  };
}

export interface GameSession {
  sessionId: string;
  mode: GameMode;
  theme?: string;
  players: PlayerInfo[];
  status: GameStatus;
  currentDoor?: Door;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CreateSessionRequest {
  mode: GameMode;
  theme?: string;
}

export interface CreateSessionResponse {
  type: 'create-session';
  session: GameSession;
}

export interface JoinSessionRequest {
  sessionId: string;
}

export interface JoinSessionResponse {
  type: 'join-session';
  session: GameSession;
}

export interface SubmitResponseRequest {
  sessionId: string;
  response: string;
}

export interface SubmitResponseResponse {
  type: 'submit-response';
  success: boolean;
}

// Leaderboard and Results types
export interface LeaderboardEntry {
  id: string;
  playerId: string;
  username: string;
  redditUserId: string;
  completionTime: number; // in milliseconds
  totalScore: number;
  averageScore: number;
  doorsCompleted: number;
  gameMode: GameMode;
  theme?: string;
  sessionId: string;
  completedAt: string;
  createdAt: string;
}

export interface GlobalLeaderboard {
  fastestCompletions: LeaderboardEntry[];
  highestAverages: LeaderboardEntry[];
  mostCompleted: LeaderboardEntry[];
  recentWinners: LeaderboardEntry[];
}

export interface LeaderboardStats {
  totalGamesCompleted: number;
  averageCompletionTime: number; // in milliseconds
  fastestEverTime: number; // in milliseconds
  highestEverAverage: number;
  mostActivePlayer: string;
  lastUpdated: string;
}

export interface PlayerRanking {
  playerId: string;
  username: string;
  position: number;
  totalScore: number;
  completionTime: string;
}

export interface PlayerStatistics {
  playerId: string;
  averageScore: number;
  doorsCompleted: number;
  totalTime: string;
}

export interface GameResults {
  winner?: string;
  rankings: PlayerRanking[];
  statistics: PlayerStatistics[];
  sessionId: string;
  gameMode: GameMode;
  theme?: string;
  completedAt: string;
}
