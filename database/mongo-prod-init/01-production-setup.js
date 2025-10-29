// MongoDB production initialization script
db = db.getSiblingDB('dumdoors_prod');

// Create production user with limited privileges
db.createUser({
  user: 'dumdoors_app',
  pwd: 'CHANGE_THIS_SECURE_PASSWORD',
  roles: [
    { role: 'readWrite', db: 'dumdoors_prod' }
  ]
});

// Create additional indexes for production performance
db.game_sessions.createIndex({ 'players.redditUserId': 1 });
db.game_sessions.createIndex({ mode: 1, status: 1 });
db.game_sessions.createIndex({ completedAt: -1 }, { sparse: true });

db.doors.createIndex({ theme: 1, difficulty: 1, createdAt: -1 });
db.doors.createIndex({ 'expectedSolutionTypes': 1 });

db.player_responses.createIndex({ playerId: 1, doorId: 1 }, { unique: true });
db.player_responses.createIndex({ aiScore: -1 });
db.player_responses.createIndex({ submittedAt: -1 });
db.player_responses.createIndex({ 'scoringMetrics.creativity': -1 });

db.leaderboard.createIndex({ totalWins: -1 });
db.leaderboard.createIndex({ fastestCompletion: 1 }, { sparse: true });
db.leaderboard.createIndex({ updatedAt: -1 });

// Create capped collection for real-time events
db.createCollection('game_events', {
  capped: true,
  size: 100000000, // 100MB
  max: 1000000     // 1M documents
});

db.game_events.createIndex({ sessionId: 1, timestamp: -1 });
db.game_events.createIndex({ eventType: 1, timestamp: -1 });

print('Production MongoDB setup completed successfully');