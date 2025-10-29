// MongoDB development seed data for DumDoors game
db = db.getSiblingDB('dumdoors');

// Insert sample doors for development
db.doors.insertMany([
  {
    doorId: 'dev_door_001',
    content: 'You find yourself in a room full of rubber ducks. They all seem to be staring at you. What do you do?',
    theme: 'absurd',
    difficulty: 2,
    expectedSolutionTypes: ['creative', 'humorous'],
    createdAt: new Date()
  },
  {
    doorId: 'dev_door_002',
    content: 'Your coffee mug has started talking to you about quantum physics. How do you respond?',
    theme: 'surreal',
    difficulty: 3,
    expectedSolutionTypes: ['creative', 'philosophical', 'humorous'],
    createdAt: new Date()
  },
  {
    doorId: 'dev_door_003',
    content: 'You wake up and realize you are a character in a video game. The player seems to be terrible at controlling you. What is your strategy?',
    theme: 'meta',
    difficulty: 4,
    expectedSolutionTypes: ['creative', 'meta', 'problem-solving'],
    createdAt: new Date()
  },
  {
    doorId: 'dev_door_004',
    content: 'Your pet rock has been giving you the silent treatment for three days. How do you make amends?',
    theme: 'absurd',
    difficulty: 1,
    expectedSolutionTypes: ['humorous', 'creative'],
    createdAt: new Date()
  },
  {
    doorId: 'dev_door_005',
    content: 'You discover that your reflection in the mirror is living a completely different life. What do you do about this situation?',
    theme: 'surreal',
    difficulty: 5,
    expectedSolutionTypes: ['creative', 'philosophical', 'imaginative'],
    createdAt: new Date()
  }
]);

// Insert sample game session for development
db.game_sessions.insertOne({
  sessionId: 'dev_session_001',
  mode: 'multiplayer',
  status: 'waiting',
  players: [
    {
      playerId: 'dev_player_001',
      username: 'TestPlayer1',
      redditUserId: 'reddit_user_001',
      joinedAt: new Date(),
      currentPosition: 0,
      totalScore: 0,
      responses: [],
      isActive: true
    }
  ],
  createdAt: new Date()
});

// Insert sample leaderboard entries
db.leaderboard.insertMany([
  {
    playerId: 'dev_player_001',
    username: 'TestPlayer1',
    totalGames: 5,
    fastestCompletion: 180,
    highestAverageScore: 85.5,
    totalWins: 2,
    updatedAt: new Date()
  },
  {
    playerId: 'dev_player_002',
    username: 'TestPlayer2',
    totalGames: 3,
    fastestCompletion: 220,
    highestAverageScore: 72.3,
    totalWins: 1,
    updatedAt: new Date()
  }
]);

print('DumDoors development seed data inserted successfully');