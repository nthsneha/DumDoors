import { useState, useEffect } from 'react';
import type { GlobalLeaderboard, LeaderboardStats, LeaderboardEntry, GameMode } from '../../shared/types/api';

interface LeaderboardProps {
  className?: string;
}

type LeaderboardCategory = 'fastest' | 'highest' | 'most' | 'recent';

interface LeaderboardFilter {
  gameMode?: GameMode;
  theme?: string;
  timeRange?: 'day' | 'week' | 'month' | 'all';
}

export const Leaderboard = ({ className = '' }: LeaderboardProps) => {
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboard | null>(null);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('fastest');
  const [filter, setFilter] = useState<LeaderboardFilter>({
    timeRange: 'all'
  });

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filter.gameMode) params.append('gameMode', filter.gameMode);
      if (filter.theme) params.append('theme', filter.theme);
      if (filter.timeRange) params.append('timeRange', filter.timeRange);
      params.append('limit', '10');

      const [leaderboardResponse, statsResponse] = await Promise.all([
        fetch(`/api/leaderboard?${params.toString()}`),
        fetch('/api/leaderboard/stats')
      ]);

      if (!leaderboardResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }

      const leaderboardData = await leaderboardResponse.json();
      const statsData = await statsResponse.json();

      setLeaderboard(leaderboardData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [filter]);

  // Format time duration
  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format score with one decimal place
  const formatScore = (score: number): string => {
    return score.toFixed(1);
  };

  // Get current category data
  const getCurrentCategoryData = (): LeaderboardEntry[] => {
    if (!leaderboard) return [];
    
    switch (activeCategory) {
      case 'fastest':
        return leaderboard.fastestCompletions;
      case 'highest':
        return leaderboard.highestAverages;
      case 'most':
        return leaderboard.mostCompleted;
      case 'recent':
        return leaderboard.recentWinners;
      default:
        return [];
    }
  };

  // Get category title and description
  const getCategoryInfo = (category: LeaderboardCategory) => {
    switch (category) {
      case 'fastest':
        return {
          title: '⚡ Fastest Completions',
          description: 'Players who completed games in the shortest time',
          icon: '🏃‍♂️'
        };
      case 'highest':
        return {
          title: '🎯 Highest Averages',
          description: 'Players with the highest average AI scores',
          icon: '🌟'
        };
      case 'most':
        return {
          title: '🔥 Most Completed',
          description: 'Players who completed the most games',
          icon: '🏆'
        };
      case 'recent':
        return {
          title: '👑 Recent Winners',
          description: 'Latest game winners',
          icon: '🎉'
        };
      default:
        return { title: '', description: '', icon: '' };
    }
  };

  if (loading) {
    return (
      <div className={`bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-white/20 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-white/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/20 border border-red-500/30 rounded-lg p-6 text-center ${className}`}>
        <div className="text-red-400 text-lg font-semibold mb-2">
          ❌ Error Loading Leaderboard
        </div>
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={fetchLeaderboard}
          className="bg-red-500/30 hover:bg-red-500/40 text-red-200 px-4 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const categoryData = getCurrentCategoryData();
  const categoryInfo = getCategoryInfo(activeCategory);

  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            🏆 Global Leaderboard
          </h2>
          <button
            onClick={fetchLeaderboard}
            className="text-white/60 hover:text-white transition-colors"
            title="Refresh leaderboard"
          >
            🔄
          </button>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalGamesCompleted}</div>
              <div className="text-xs text-white/60">Games Completed</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{formatTime(stats.fastestEverTime)}</div>
              <div className="text-xs text-white/60">Fastest Time</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{formatScore(stats.highestEverAverage)}</div>
              <div className="text-xs text-white/60">Highest Average</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{formatTime(stats.averageCompletionTime)}</div>
              <div className="text-xs text-white/60">Avg. Time</div>
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {(['fastest', 'highest', 'most', 'recent'] as LeaderboardCategory[]).map((category) => {
            const info = getCategoryInfo(category);
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeCategory === category
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <span className="mr-1">{info.icon}</span>
                {info.title.replace(/^[^\s]+ /, '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-white/20 bg-white/5">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-white/80 text-sm">Mode:</label>
            <select
              value={filter.gameMode || ''}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                gameMode: e.target.value as GameMode || undefined 
              }))}
              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
            >
              <option value="">All Modes</option>
              <option value="multiplayer">Multiplayer</option>
              <option value="single-player">Single Player</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-white/80 text-sm">Time:</label>
            <select
              value={filter.timeRange || 'all'}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                timeRange: e.target.value as any 
              }))}
              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
            >
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="week">This Week</option>
              <option value="day">Today</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Header */}
      <div className="p-4 bg-gradient-to-r from-blue-600/20 to-blue-500/20">
        <h3 className="text-lg font-semibold text-white mb-1">{categoryInfo.title}</h3>
        <p className="text-white/70 text-sm">{categoryInfo.description}</p>
      </div>

      {/* Leaderboard List */}
      <div className="p-4">
        {categoryData.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <div className="text-4xl mb-2">🏆</div>
            <p>No entries found for this category</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categoryData.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-all hover:bg-white/10 ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' :
                  index === 1 ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border border-gray-400/30' :
                  index === 2 ? 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border border-amber-600/30' :
                  'bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-yellow-500 text-yellow-900' :
                    index === 1 ? 'bg-gray-400 text-gray-900' :
                    index === 2 ? 'bg-amber-600 text-amber-900' :
                    'bg-white/20 text-white'
                  }`}>
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                  </div>
                  
                  <div>
                    <div className="font-semibold text-white">{entry.username}</div>
                    <div className="text-xs text-white/60 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        entry.gameMode === 'multiplayer' 
                          ? 'bg-blue-500/30 text-blue-200' 
                          : 'bg-green-500/30 text-green-200'
                      }`}>
                        {entry.gameMode === 'multiplayer' ? '👥 Multi' : '👤 Solo'}
                      </span>
                      {entry.theme && (
                        <span className="bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded text-xs">
                          {entry.theme}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-white">
                    {activeCategory === 'fastest' && formatTime(entry.completionTime)}
                    {activeCategory === 'highest' && formatScore(entry.averageScore)}
                    {activeCategory === 'most' && `${entry.doorsCompleted} doors`}
                    {activeCategory === 'recent' && formatTime(entry.completionTime)}
                  </div>
                  <div className="text-xs text-white/60">
                    {activeCategory === 'fastest' && `${formatScore(entry.averageScore)} avg`}
                    {activeCategory === 'highest' && `${entry.doorsCompleted} doors`}
                    {activeCategory === 'most' && `${formatScore(entry.averageScore)} avg`}
                    {activeCategory === 'recent' && new Date(entry.completedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/20 text-center">
        <p className="text-white/60 text-sm">
          {stats && `Last updated: ${new Date(stats.lastUpdated).toLocaleString()}`}
        </p>
      </div>
    </div>
  );
};