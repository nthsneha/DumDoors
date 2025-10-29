import { redis, reddit } from '@devvit/web/server';
import type { 
  LeaderboardEntry, 
  GlobalLeaderboard, 
  LeaderboardStats, 
  GameMode,
  GameResults
} from '../../shared/types/api';

export class LeaderboardService {
  private readonly LEADERBOARD_KEY = 'dumdoors:leaderboard';
  private readonly STATS_KEY = 'dumdoors:stats';
  private readonly USER_SCORES_KEY = 'dumdoors:user_scores';
  private readonly DAILY_SCORES_KEY = 'dumdoors:daily_scores';

  // Submit a game result to the leaderboard
  async submitGameResult(gameResults: GameResults, redditUserId?: string): Promise<void> {
    try {
      console.log('📊 [LEADERBOARD] Submitting game result:', gameResults);
      const timestamp = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      // Get Reddit username if available
      let username = 'anonymous';
      if (redditUserId) {
        try {
          const user = await reddit.getUserById(redditUserId as `t2_${string}`);
          if (user) {
            username = user.username;
          }
        } catch (error) {
          console.warn('Failed to get Reddit username:', error);
        }
      }

      // Process each player's results
      for (const ranking of gameResults.rankings) {
        const playerStats = gameResults.statistics.find(s => s.playerId === ranking.playerId);
        if (!playerStats) continue;

        // Parse completion time (assuming format like "4m 32s")
        const completionTimeMs = this.parseTimeToMilliseconds(ranking.completionTime);

        const entry: LeaderboardEntry = {
          id: `${gameResults.sessionId}_${ranking.playerId}`,
          playerId: ranking.playerId,
          username: ranking.username || username,
          redditUserId: redditUserId || ranking.playerId,
          completionTime: completionTimeMs,
          totalScore: ranking.totalScore,
          averageScore: playerStats.averageScore,
          doorsCompleted: playerStats.doorsCompleted,
          gameMode: gameResults.gameMode,
          ...(gameResults.theme && { theme: gameResults.theme }),
          sessionId: gameResults.sessionId,
          completedAt: gameResults.completedAt,
          createdAt: timestamp
        };

        console.log('📊 [LEADERBOARD] Storing entry:', entry);

        // Store the entry (simplified version)
        await this.storeLeaderboardEntry(entry);

        // Update user's personal best scores
        await this.updateUserBestScores(entry);

        // Update daily scores for Reddit integration
        await this.updateDailyScores(entry, today);
      }

      // Update global stats
      await this.updateGlobalStats();

      console.log('✅ [LEADERBOARD] Game result submitted successfully');

    } catch (error) {
      console.error('❌ [LEADERBOARD] Error submitting game result:', error);
      // Don't throw the error to avoid breaking the game flow
    }
  }

  // Get global leaderboard with filters
  async getGlobalLeaderboard(
    gameMode?: GameMode,
    theme?: string,
    timeRange: 'day' | 'week' | 'month' | 'all' = 'all',
    limit: number = 10
  ): Promise<GlobalLeaderboard> {
    try {
      const entries = await this.getFilteredEntries(gameMode, theme, timeRange);

      // Sort entries for different categories
      const fastestCompletions = [...entries]
        .sort((a, b) => a.completionTime - b.completionTime)
        .slice(0, limit);

      const highestAverages = [...entries]
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, limit);

      const mostCompleted = [...entries]
        .sort((a, b) => b.doorsCompleted - a.doorsCompleted)
        .slice(0, limit);

      const recentWinners = [...entries]
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, limit);

      return {
        fastestCompletions,
        highestAverages,
        mostCompleted,
        recentWinners
      };
    } catch (error) {
      console.error('Error getting global leaderboard:', error);
      throw error;
    }
  }

  // Get leaderboard statistics
  async getLeaderboardStats(): Promise<LeaderboardStats> {
    try {
      const statsData = await redis.get(this.STATS_KEY);
      
      if (statsData) {
        return JSON.parse(statsData);
      }

      // If no stats exist, calculate them
      await this.updateGlobalStats();
      const newStatsData = await redis.get(this.STATS_KEY);
      
      return newStatsData ? JSON.parse(newStatsData) : this.getDefaultStats();
    } catch (error) {
      console.error('Error getting leaderboard stats:', error);
      return this.getDefaultStats();
    }
  }

  // Get user's personal leaderboard position and stats
  async getUserStats(redditUserId: string): Promise<{
    personalBest: LeaderboardEntry | null;
    globalRank: number;
    totalGamesPlayed: number;
    averageScore: number;
  }> {
    try {
      const userScoresData = await redis.get(`${this.USER_SCORES_KEY}:${redditUserId}`);
      
      if (!userScoresData) {
        return {
          personalBest: null,
          globalRank: 0,
          totalGamesPlayed: 0,
          averageScore: 0
        };
      }

      const userScores = JSON.parse(userScoresData);
      const allEntries = await this.getAllEntries();
      
      // Find user's global rank based on highest average score
      const sortedByAverage = allEntries.sort((a, b) => b.averageScore - a.averageScore);
      const userRank = sortedByAverage.findIndex(entry => entry.redditUserId === redditUserId) + 1;

      return {
        personalBest: userScores.personalBest,
        globalRank: userRank,
        totalGamesPlayed: userScores.totalGames || 0,
        averageScore: userScores.averageScore || 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        personalBest: null,
        globalRank: 0,
        totalGamesPlayed: 0,
        averageScore: 0
      };
    }
  }

  // Get daily leaderboard for Reddit post integration
  async getDailyLeaderboard(date?: string): Promise<LeaderboardEntry[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const dailyScoresData = await redis.get(`${this.DAILY_SCORES_KEY}:${targetDate}`);
      
      if (!dailyScoresData) {
        return [];
      }

      const dailyScores = JSON.parse(dailyScoresData);
      return dailyScores.sort((a: LeaderboardEntry, b: LeaderboardEntry) => 
        b.averageScore - a.averageScore
      ).slice(0, 10);
    } catch (error) {
      console.error('Error getting daily leaderboard:', error);
      return [];
    }
  }

  // Private helper methods
  private async storeLeaderboardEntry(entry: LeaderboardEntry): Promise<void> {
    try {
      const key = `${this.LEADERBOARD_KEY}:${entry.id}`;
      await redis.set(key, JSON.stringify(entry));
      console.log('✅ [LEADERBOARD] Entry stored with key:', key);
      
      // Also maintain a list of all entry IDs for easy retrieval
      const entriesListKey = `${this.LEADERBOARD_KEY}:all_entries`;
      const existingIds = await redis.get(entriesListKey);
      const ids = existingIds ? JSON.parse(existingIds) : [];
      
      if (!ids.includes(entry.id)) {
        ids.push(entry.id);
        await redis.set(entriesListKey, JSON.stringify(ids));
      }
      
    } catch (error) {
      console.error('❌ [LEADERBOARD] Error storing entry:', error);
      throw error;
    }
  }

  private async updateUserBestScores(entry: LeaderboardEntry): Promise<void> {
    const userKey = `${this.USER_SCORES_KEY}:${entry.redditUserId}`;
    const existingData = await redis.get(userKey);
    
    let userScores = existingData ? JSON.parse(existingData) : {
      personalBest: null,
      totalGames: 0,
      totalScore: 0,
      averageScore: 0
    };

    // Update total games and scores
    userScores.totalGames += 1;
    userScores.totalScore += entry.totalScore;
    userScores.averageScore = userScores.totalScore / userScores.totalGames;

    // Update personal best if this is better
    if (!userScores.personalBest || entry.averageScore > userScores.personalBest.averageScore) {
      userScores.personalBest = entry;
    }

    await redis.set(userKey, JSON.stringify(userScores));
  }

  private async updateDailyScores(entry: LeaderboardEntry, date: string): Promise<void> {
    const dailyKey = `${this.DAILY_SCORES_KEY}:${date}`;
    const existingData = await redis.get(dailyKey);
    
    let dailyScores = existingData ? JSON.parse(existingData) : [];
    dailyScores.push(entry);
    
    // Keep only top 50 for the day to manage storage
    dailyScores = dailyScores
      .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.averageScore - a.averageScore)
      .slice(0, 50);

    await redis.set(dailyKey, JSON.stringify(dailyScores));
    
    // Set expiration for daily scores (keep for 30 days)
    await redis.expire(dailyKey, 30 * 24 * 60 * 60);
  }

  private async updateGlobalStats(): Promise<void> {
    try {
      const allEntries = await this.getAllEntries();
      
      if (allEntries.length === 0) {
        await redis.set(this.STATS_KEY, JSON.stringify(this.getDefaultStats()));
        return;
      }

      const totalGames = allEntries.length;
      const totalCompletionTime = allEntries.reduce((sum, entry) => sum + entry.completionTime, 0);
      const averageCompletionTime = totalCompletionTime / totalGames;
      
      const fastestTime = Math.min(...allEntries.map(entry => entry.completionTime));
      const highestAverage = Math.max(...allEntries.map(entry => entry.averageScore));
      
      // Find most active player
      const playerCounts = allEntries.reduce((counts, entry) => {
        counts[entry.username] = (counts[entry.username] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      const mostActivePlayer = Object.entries(playerCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

      const stats: LeaderboardStats = {
        totalGamesCompleted: totalGames,
        averageCompletionTime,
        fastestEverTime: fastestTime,
        highestEverAverage: highestAverage,
        mostActivePlayer,
        lastUpdated: new Date().toISOString()
      };

      await redis.set(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('Error updating global stats:', error);
    }
  }

  private async getFilteredEntries(
    gameMode?: GameMode,
    theme?: string,
    timeRange: 'day' | 'week' | 'month' | 'all' = 'all'
  ): Promise<LeaderboardEntry[]> {
    const allEntries = await this.getAllEntries();
    
    return allEntries.filter(entry => {
      // Filter by game mode
      if (gameMode && entry.gameMode !== gameMode) {
        return false;
      }
      
      // Filter by theme
      if (theme && entry.theme !== theme) {
        return false;
      }
      
      // Filter by time range
      if (timeRange !== 'all') {
        const entryDate = new Date(entry.completedAt);
        const now = new Date();
        const diffTime = now.getTime() - entryDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        switch (timeRange) {
          case 'day':
            if (diffDays > 1) return false;
            break;
          case 'week':
            if (diffDays > 7) return false;
            break;
          case 'month':
            if (diffDays > 30) return false;
            break;
        }
      }
      
      return true;
    });
  }

  private async getAllEntries(): Promise<LeaderboardEntry[]> {
    try {
      // Simplified approach - get entries from a list instead of using keys
      // Since Redis keys might not be available, we'll use a simpler approach
      const entriesListKey = `${this.LEADERBOARD_KEY}:all_entries`;
      const entryIds = await redis.get(entriesListKey);
      
      if (!entryIds) {
        return [];
      }

      const ids = JSON.parse(entryIds) as string[];
      const entries: LeaderboardEntry[] = [];
      
      for (const id of ids) {
        const data = await redis.get(`${this.LEADERBOARD_KEY}:${id}`);
        if (data) {
          entries.push(JSON.parse(data));
        }
      }
      
      return entries;
    } catch (error) {
      console.error('Error getting all entries:', error);
      return [];
    }
  }

  private parseTimeToMilliseconds(timeString: string): number {
    // Parse time strings like "4m 32s" or "1h 23m 45s"
    const timeRegex = /(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/;
    const match = timeString.match(timeRegex);
    
    if (!match) {
      return 0;
    }
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  private getDefaultStats(): LeaderboardStats {
    return {
      totalGamesCompleted: 0,
      averageCompletionTime: 0,
      fastestEverTime: 0,
      highestEverAverage: 0,
      mostActivePlayer: 'No players yet',
      lastUpdated: new Date().toISOString()
    };
  }
}

export const leaderboardService = new LeaderboardService();