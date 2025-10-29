import { reddit, context } from '@devvit/web/server';
import { leaderboardService } from './leaderboardService';
import type { LeaderboardEntry } from '../../shared/types/api';

export class RedditIntegrationService {
  // Post daily leaderboard to the subreddit
  async postDailyLeaderboard(date?: string): Promise<string | null> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(targetDate);
      
      if (dailyLeaderboard.length === 0) {
        console.log('No games played today, skipping daily leaderboard post');
        return null;
      }

      const formattedDate = new Date(targetDate + 'T00:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Create the post content
      const postTitle = `🏆 DumDoors Daily Leaderboard - ${formattedDate}`;
      const postContent = this.formatLeaderboardPost(dailyLeaderboard, formattedDate);

      // Create the post
      const post = await reddit.submitPost({
        title: postTitle,
        text: postContent,
        subredditName: context.subredditName!,
      });

      console.log(`✅ Daily leaderboard posted: ${post.id}`);
      return post.id;
    } catch (error) {
      console.error('❌ Error posting daily leaderboard:', error);
      return null;
    }
  }

  // Post weekly leaderboard summary
  async postWeeklyLeaderboard(): Promise<string | null> {
    try {
      const weeklyLeaderboard = await leaderboardService.getGlobalLeaderboard(
        undefined, // all game modes
        undefined, // all themes
        'week',
        20 // top 20 for weekly
      );

      const postTitle = `🎯 DumDoors Weekly Champions - Week of ${new Date().toLocaleDateString()}`;
      const postContent = this.formatWeeklyLeaderboardPost(weeklyLeaderboard);

      const post = await reddit.submitPost({
        title: postTitle,
        text: postContent,
        subredditName: context.subredditName!,
      });

      console.log(`✅ Weekly leaderboard posted: ${post.id}`);
      return post.id;
    } catch (error) {
      console.error('❌ Error posting weekly leaderboard:', error);
      return null;
    }
  }

  // Get user's Reddit profile and stats
  async getUserRedditStats(username: string): Promise<{
    user: any;
    gameStats: any;
  } | null> {
    try {
      const user = await reddit.getUserByUsername(username);
      if (!user) {
        return null;
      }
      const gameStats = await leaderboardService.getUserStats(user.id);
      
      return {
        user,
        gameStats
      };
    } catch (error) {
      console.error('❌ Error getting user Reddit stats:', error);
      return null;
    }
  }

  // Award user flair based on achievements
  async updateUserFlair(username: string): Promise<void> {
    try {
      const userStats = await leaderboardService.getUserStats(username);
      
      if (!userStats.personalBest) {
        return;
      }

      let flairText = '';
      let flairClass = '';

      // Determine flair based on achievements
      if (userStats.personalBest.averageScore >= 90) {
        flairText = '🏆 DumDoors Master';
        flairClass = 'gold';
      } else if (userStats.personalBest.averageScore >= 80) {
        flairText = '🥇 DumDoors Expert';
        flairClass = 'silver';
      } else if (userStats.personalBest.averageScore >= 70) {
        flairText = '🥈 DumDoors Pro';
        flairClass = 'bronze';
      } else if (userStats.totalGamesPlayed >= 10) {
        flairText = '🎮 DumDoors Veteran';
        flairClass = 'regular';
      } else if (userStats.totalGamesPlayed >= 1) {
        flairText = '🚪 Door Opener';
        flairClass = 'newbie';
      }

      if (flairText) {
        await reddit.setUserFlair({
          subredditName: context.subredditName!,
          username: username,
          text: flairText,
          cssClass: flairClass,
        });
        
        console.log(`✅ Updated flair for ${username}: ${flairText}`);
      }
    } catch (error) {
      console.error('❌ Error updating user flair:', error);
    }
  }

  // Create achievement announcement post
  async announceAchievement(username: string, achievement: string, details: string): Promise<string | null> {
    try {
      const postTitle = `🎉 Achievement Unlocked: ${username} - ${achievement}!`;
      const postContent = `Congratulations to u/${username} for achieving **${achievement}**!\n\n${details}\n\n---\n\n*Play DumDoors and see if you can beat this achievement!*`;

      const post = await reddit.submitPost({
        title: postTitle,
        text: postContent,
        subredditName: context.subredditName!,
      });

      console.log(`✅ Achievement announcement posted: ${post.id}`);
      return post.id;
    } catch (error) {
      console.error('❌ Error posting achievement announcement:', error);
      return null;
    }
  }

  // Private helper methods
  private formatLeaderboardPost(leaderboard: LeaderboardEntry[], date: string): string {
    let content = `# 🏆 DumDoors Daily Leaderboard - ${date}\n\n`;
    content += `Today's top performers in the art of questionable decision-making!\n\n`;
    content += `## 🎯 Top Players\n\n`;
    content += `| Rank | Player | Score | Doors | Time | Mode |\n`;
    content += `|------|--------|-------|-------|------|------|\n`;

    leaderboard.slice(0, 10).forEach((entry, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const mode = entry.gameMode === 'multiplayer' ? '👥 Multi' : '👤 Solo';
      
      content += `| ${medal} | u/${entry.username} | ${entry.averageScore.toFixed(1)} | ${entry.doorsCompleted} | ${this.formatTime(entry.completionTime)} | ${mode} |\n`;
    });

    content += `\n## 📊 Daily Stats\n\n`;
    content += `- **Total Games Played:** ${leaderboard.length}\n`;
    content += `- **Average Score:** ${(leaderboard.reduce((sum, entry) => sum + entry.averageScore, 0) / leaderboard.length).toFixed(1)}\n`;
    content += `- **Fastest Completion:** ${this.formatTime(Math.min(...leaderboard.map(e => e.completionTime)))}\n`;
    content += `- **Most Doors Completed:** ${Math.max(...leaderboard.map(e => e.doorsCompleted))}\n\n`;

    content += `---\n\n`;
    content += `*Want to see your name on tomorrow's leaderboard? Play DumDoors and make some questionably brilliant decisions!*\n\n`;
    content += `🎮 **[Play DumDoors Now!](https://reddit.com/r/${context.subredditName})**`;

    return content;
  }

  private formatWeeklyLeaderboardPost(leaderboard: any): string {
    let content = `# 🎯 DumDoors Weekly Champions\n\n`;
    content += `This week's masters of creative chaos and questionable decision-making!\n\n`;

    // Fastest completions
    content += `## ⚡ Fastest Completions\n\n`;
    leaderboard.fastestCompletions.slice(0, 5).forEach((entry: LeaderboardEntry, index: number) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
      content += `${medal} **u/${entry.username}** - ${this.formatTime(entry.completionTime)} (${entry.averageScore.toFixed(1)} avg)\n\n`;
    });

    // Highest averages
    content += `## 🌟 Highest Average Scores\n\n`;
    leaderboard.highestAverages.slice(0, 5).forEach((entry: LeaderboardEntry, index: number) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
      content += `${medal} **u/${entry.username}** - ${entry.averageScore.toFixed(1)} points (${entry.doorsCompleted} doors)\n\n`;
    });

    // Most completed
    content += `## 🔥 Most Games Completed\n\n`;
    leaderboard.mostCompleted.slice(0, 5).forEach((entry: LeaderboardEntry, index: number) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
      content += `${medal} **u/${entry.username}** - ${entry.doorsCompleted} doors (${entry.averageScore.toFixed(1)} avg)\n\n`;
    });

    content += `---\n\n`;
    content += `*Think you can make it to next week's leaderboard? The doors are waiting for your questionable wisdom!*\n\n`;
    content += `🎮 **[Play DumDoors Now!](https://reddit.com/r/${context.subredditName})**`;

    return content;
  }

  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

export const redditIntegrationService = new RedditIntegrationService();