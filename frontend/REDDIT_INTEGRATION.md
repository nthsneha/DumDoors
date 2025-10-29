# DumDoors Reddit Integration

This document explains how the DumDoors leaderboard integrates with Reddit to create an engaging community experience.

## Features

### 🏆 Leaderboard System
- **Local Storage**: Game results are stored in Redis for fast access
- **Multiple Categories**: Fastest completions, highest averages, most completed, recent winners
- **Time-based Filtering**: Daily, weekly, monthly, and all-time leaderboards
- **Reddit Integration**: Automatic username detection and flair updates

### 📅 Daily Leaderboard Posts
- Automatically posts daily top performers to the subreddit
- Includes game stats, player rankings, and formatted tables
- Only posts if games were played that day
- Includes links back to the game

### 📊 Weekly Champion Posts
- Weekly summary of top performers across all categories
- Highlights fastest completions, highest averages, and most active players
- Formatted for maximum Reddit engagement

### 🏷️ User Flair System
- Automatically updates user flair based on achievements:
  - **🏆 DumDoors Master**: 90+ average score
  - **🥇 DumDoors Expert**: 80+ average score  
  - **🥈 DumDoors Pro**: 70+ average score
  - **🎮 DumDoors Veteran**: 10+ games played
  - **🚪 Door Opener**: First game completed

## API Endpoints

### Leaderboard Endpoints
```
GET /api/leaderboard - Get global leaderboard with filters
GET /api/leaderboard/stats - Get leaderboard statistics
POST /api/leaderboard/submit - Submit game results
GET /api/leaderboard/user/:userId - Get user's personal stats
GET /api/leaderboard/daily/:date? - Get daily leaderboard
```

### Reddit Integration Endpoints
```
POST /api/reddit/daily-leaderboard - Post daily leaderboard to Reddit
POST /api/reddit/weekly-leaderboard - Post weekly leaderboard to Reddit
GET /api/reddit/user/:username/stats - Get Reddit user stats
POST /api/reddit/update-flair/:username - Update user flair
```

## How It Works

### 1. Game Completion
When a player completes a game:
1. Game results are submitted to `/api/leaderboard/submit`
2. Results are stored in Redis with multiple indexes for efficient querying
3. User's personal best scores are updated
4. Daily scores are tracked for Reddit integration
5. User flair is automatically updated based on new achievements

### 2. Leaderboard Display
The leaderboard component:
- Fetches data from the local API (no external dependencies)
- Shows Reddit usernames with special badges
- Allows filtering by game mode, theme, and time range
- Includes admin controls for posting to Reddit

### 3. Reddit Integration
- **Daily Posts**: Can be triggered manually or scheduled
- **User Flair**: Updated automatically after each game
- **Achievement Announcements**: Can be triggered for special achievements
- **Community Engagement**: Formatted posts encourage participation

## Usage

### For Players
1. Play DumDoors games normally
2. Your scores are automatically tracked
3. Check the leaderboard to see your ranking
4. Your Reddit flair updates based on your performance

### For Moderators
1. Use the "🤖 Reddit Admin" button in the main menu
2. Post daily/weekly leaderboards to engage the community
3. Monitor the leaderboard for interesting achievements
4. User flairs update automatically

### For Developers
1. Game results are automatically submitted via the existing game flow
2. The leaderboard service handles all data management
3. Reddit integration is optional and fails gracefully
4. All data is stored locally in Redis

## Data Structure

### LeaderboardEntry
```typescript
{
  id: string;
  playerId: string;
  username: string;
  redditUserId: string;
  completionTime: number; // milliseconds
  totalScore: number;
  averageScore: number;
  doorsCompleted: number;
  gameMode: 'multiplayer' | 'single-player';
  theme?: string;
  sessionId: string;
  completedAt: string;
  createdAt: string;
}
```

### Storage Keys
- `dumdoors:leaderboard:*` - Individual leaderboard entries
- `dumdoors:stats` - Global statistics
- `dumdoors:user_scores:*` - User personal bests
- `dumdoors:daily_scores:*` - Daily leaderboards

## Benefits for Reddit Community

1. **Engagement**: Daily/weekly posts keep the community active
2. **Competition**: Visible leaderboards encourage friendly competition
3. **Recognition**: Flair system rewards good players
4. **Content**: Automated posts provide regular subreddit content
5. **Integration**: Seamless connection between game and Reddit community

## Future Enhancements

- Scheduled automatic posting (daily/weekly)
- Achievement system with special announcements
- Tournament mode with bracket-style competition
- Cross-subreddit leaderboards
- Player profile pages with detailed stats
- Seasonal leaderboard resets