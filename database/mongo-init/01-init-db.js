// MongoDB initialization script for DumDoors game
db = db.getSiblingDB('dumdoors');

// Create collections with validation schemas
db.createCollection('game_sessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['sessionId', 'mode', 'status', 'createdAt'],
      properties: {
        sessionId: {
          bsonType: 'string',
          description: 'Unique session identifier'
        },
        mode: {
          enum: ['multiplayer', 'single-player'],
          description: 'Game mode'
        },
        theme: {
          bsonType: 'string',
          description: 'Theme for single-player mode'
        },
        status: {
          enum: ['waiting', 'active', 'completed'],
          description: 'Current session status'
        },
        players: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['playerId', 'username', 'redditUserId'],
            properties: {
              playerId: { bsonType: 'string' },
              username: { bsonType: 'string' },
              redditUserId: { bsonType: 'string' },
              joinedAt: { bsonType: 'date' },
              currentPosition: { bsonType: 'int' },
              totalScore: { bsonType: 'int' },
              isActive: { bsonType: 'bool' }
            }
          }
        },
        createdAt: { bsonType: 'date' },
        startedAt: { bsonType: 'date' },
        completedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('doors', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['doorId', 'content', 'theme', 'difficulty', 'createdAt'],
      properties: {
        doorId: {
          bsonType: 'string',
          description: 'Unique door identifier'
        },
        content: {
          bsonType: 'string',
          description: 'Door scenario content'
        },
        theme: {
          bsonType: 'string',
          description: 'Door theme category'
        },
        difficulty: {
          bsonType: 'int',
          minimum: 1,
          maximum: 10,
          description: 'Difficulty level 1-10'
        },
        expectedSolutionTypes: {
          bsonType: 'array',
          items: { bsonType: 'string' }
        },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('player_responses', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['responseId', 'doorId', 'playerId', 'content', 'submittedAt'],
      properties: {
        responseId: { bsonType: 'string' },
        doorId: { bsonType: 'string' },
        playerId: { bsonType: 'string' },
        content: {
          bsonType: 'string',
          maxLength: 500,
          description: 'Player response content (max 500 chars)'
        },
        aiScore: {
          bsonType: 'int',
          minimum: 0,
          maximum: 100
        },
        scoringMetrics: {
          bsonType: 'object',
          properties: {
            creativity: { bsonType: 'int', minimum: 0, maximum: 100 },
            feasibility: { bsonType: 'int', minimum: 0, maximum: 100 },
            humor: { bsonType: 'int', minimum: 0, maximum: 100 },
            originality: { bsonType: 'int', minimum: 0, maximum: 100 }
          }
        },
        submittedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('leaderboard', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['playerId', 'username', 'totalGames', 'updatedAt'],
      properties: {
        playerId: { bsonType: 'string' },
        username: { bsonType: 'string' },
        totalGames: { bsonType: 'int' },
        fastestCompletion: { bsonType: 'int' },
        highestAverageScore: { bsonType: 'double' },
        totalWins: { bsonType: 'int' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes for performance
db.game_sessions.createIndex({ sessionId: 1 }, { unique: true });
db.game_sessions.createIndex({ status: 1 });
db.game_sessions.createIndex({ createdAt: -1 });

db.doors.createIndex({ doorId: 1 }, { unique: true });
db.doors.createIndex({ theme: 1, difficulty: 1 });

db.player_responses.createIndex({ responseId: 1 }, { unique: true });
db.player_responses.createIndex({ playerId: 1, submittedAt: -1 });
db.player_responses.createIndex({ doorId: 1 });

db.leaderboard.createIndex({ playerId: 1 }, { unique: true });
db.leaderboard.createIndex({ fastestCompletion: 1 });
db.leaderboard.createIndex({ highestAverageScore: -1 });

print('DumDoors MongoDB initialization completed successfully');