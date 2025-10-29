# Global Leaderboard API Documentation

This document describes the global leaderboard functionality implemented for the DumDoors game.

## Overview

The global leaderboard tracks player performance across all completed games, providing various ranking categories and statistics. It automatically records game completions and provides cached, fast access to leaderboard data.

## API Endpoints

### GET /api/leaderboard

Retrieves the global leaderboard with all categories.

**Query Parameters:**
- `limit` (optional): Number of entries per category (default: 10, max: 100)
- `gameMode` (optional): Filter by game mode ("multiplayer" or "single-player")
- `theme` (optional): Filter by game theme
- `timeRange` (optional): Filter by time range ("day", "week", "month", "all")

**Response:**
```json
{
  "success": true,
  "leaderboard": {
    "fastestCompletions": [...],
    "highestAverages": [...],
    "mostCompleted": [...],
    "recentWinners": [...]
  },
  "filter": {
    "limit": 10,
    "gameMode": "multiplayer"
  }
}
```

### GET /api/leaderboard/stats

Retrieves aggregated leaderboard statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalGamesCompleted": 1250,
    "averageCompletionTime": "8m30s",
    "fastestEverTime": "2m15s",
    "highestEverAverage": 95.5,
    "mostActivePlayer": "player-123",
    "lastUpdated": "2025-10-27T10:30:00Z"
  }
}
```

### GET /api/leaderboard/fastest

Retrieves the fastest completion times leaderboard.

**Query Parameters:** Same as global leaderboard

**Response:**
```json
{
  "success": true,
  "entries": [
    {
      "id": "...",
      "playerId": "player-123",
      "username": "SpeedRunner",
      "completionTime": "2m15s",
      "totalScore": 450,
      "averageScore": 90.0,
      "doorsCompleted": 5,
      "gameMode": "multiplayer",
      "completedAt": "2025-10-27T10:00:00Z"
    }
  ]
}
```

### GET /api/leaderboard/highest-averages

Retrieves the highest average scores leaderboard.

**Query Parameters:** Same as global leaderboard

**Response:** Same structure as fastest completions, sorted by average score.

### GET /api/leaderboard/player/:playerId/rank/:category

Retrieves a player's rank in a specific category.

**Path Parameters:**
- `playerId`: The player's unique identifier
- `category`: The ranking category ("fastest", "highest_avg", "most_completed")

**Response:**
```json
{
  "success": true,
  "playerId": "player-123",
  "category": "fastest",
  "rank": 15
}
```

## Data Models

### LeaderboardEntry

```go
type LeaderboardEntry struct {
    ID               primitive.ObjectID `json:"id"`
    PlayerID         string             `json:"playerId"`
    Username         string             `json:"username"`
    RedditUserID     string             `json:"redditUserId"`
    CompletionTime   time.Duration      `json:"completionTime"`
    TotalScore       int                `json:"totalScore"`
    AverageScore     float64            `json:"averageScore"`
    DoorsCompleted   int                `json:"doorsCompleted"`
    GameMode         GameMode           `json:"gameMode"`
    Theme            *string            `json:"theme,omitempty"`
    SessionID        string             `json:"sessionId"`
    CompletedAt      time.Time          `json:"completedAt"`
    CreatedAt        time.Time          `json:"createdAt"`
}
```

### GlobalLeaderboard

```go
type GlobalLeaderboard struct {
    FastestCompletions []LeaderboardEntry `json:"fastestCompletions"`
    HighestAverages    []LeaderboardEntry `json:"highestAverages"`
    MostCompleted      []LeaderboardEntry `json:"mostCompleted"`
    RecentWinners      []LeaderboardEntry `json:"recentWinners"`
}
```

## Automatic Recording

The leaderboard automatically records entries when:
1. A game session is completed (status changes to "completed")
2. A player has completed at least one door
3. The game completion handler is triggered

The recording includes:
- Player information (ID, username, Reddit user ID)
- Game performance (total score, average score, doors completed)
- Timing information (completion time, completion date)
- Game context (mode, theme, session ID)

## Caching Strategy

The leaderboard uses a two-tier caching strategy:

1. **Redis Cache**: Fast access for frequently requested leaderboards (5-minute TTL)
2. **MongoDB Aggregation**: Source of truth with complex queries and filtering

Cache keys:
- `leaderboard:fastest_completions`
- `leaderboard:highest_averages`
- `leaderboard:most_completed`
- `leaderboard:stats`

## Performance Considerations

- Leaderboard queries are optimized with MongoDB indexes on:
  - `completionTime` (ascending)
  - `averageScore` (descending)
  - `doorsCompleted` (descending)
  - `completedAt` (descending)
  - `gameMode` and `theme` for filtering

- Concurrent requests for different categories are handled in parallel
- Results are limited to prevent large response payloads
- Redis caching reduces database load for popular queries

## Integration Points

The leaderboard integrates with:

1. **Game Service**: Automatic recording on game completion
2. **Progress Service**: Real-time updates during gameplay
3. **WebSocket Manager**: Broadcasting leaderboard updates
4. **Database Layer**: MongoDB for persistence, Redis for caching

## Error Handling

- Graceful degradation when leaderboard service is unavailable
- Fallback to empty results rather than failing requests
- Warning logs for cache misses or recording failures
- Proper HTTP status codes for different error conditions

## Future Enhancements

Potential improvements for the leaderboard system:

1. **Seasonal Leaderboards**: Reset rankings periodically
2. **Achievement System**: Special badges for milestones
3. **Player Profiles**: Detailed statistics and history
4. **Social Features**: Friend leaderboards and challenges
5. **Analytics Dashboard**: Admin interface for leaderboard insights