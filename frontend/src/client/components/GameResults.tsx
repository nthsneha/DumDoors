import { useState } from 'react';
import type {
  GameResults as GameResultsType,
  PlayerRanking,
  PlayerStatistics,
  GameMode,
} from '../../shared/types/api';

interface GameResultsProps {
  results: GameResultsType;
  currentPlayerId?: string;
  onPlayAgain?: () => void;
  onViewLeaderboard?: () => void;
  onBackToLobby?: () => void;
  className?: string;
}

type ResultsView = 'rankings' | 'statistics' | 'performance';

export const GameResults = ({
  results,
  currentPlayerId,
  onPlayAgain,
  onViewLeaderboard,
  onBackToLobby,
  className = '',
}: GameResultsProps) => {
  const [activeView, setActiveView] = useState<ResultsView>('rankings');

  // Find current player's ranking and stats
  const currentPlayerRanking = results.rankings.find((r) => r.playerId === currentPlayerId);
  const currentPlayerStats = results.statistics.find((s) => s.playerId === currentPlayerId);

  // Format time duration
  const formatTime = (timeString: string): string => {
    try {
      // Handle both duration strings and ISO dates
      if (timeString.includes('T')) {
        // ISO date - calculate duration from game start
        const completedAt = new Date(timeString);
        const gameStart = new Date(results.completedAt);
        const duration = completedAt.getTime() - gameStart.getTime();
        return formatDuration(duration);
      } else {
        // Duration string like "2m 30s" or milliseconds
        const ms = parseInt(timeString);
        if (!isNaN(ms)) {
          return formatDuration(ms);
        }
        return timeString;
      }
    } catch {
      return timeString;
    }
  };

  const formatDuration = (milliseconds: number): string => {
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

  // Get position suffix (1st, 2nd, 3rd, etc.)
  const getPositionSuffix = (position: number): string => {
    const lastDigit = position % 10;
    const lastTwoDigits = position % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return `${position}th`;
    }

    switch (lastDigit) {
      case 1:
        return `${position}st`;
      case 2:
        return `${position}nd`;
      case 3:
        return `${position}rd`;
      default:
        return `${position}th`;
    }
  };

  // Get medal emoji for top 3 positions
  const getMedalEmoji = (position: number): string => {
    switch (position) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '🏅';
    }
  };

  // Get performance grade based on average score
  const getPerformanceGrade = (
    averageScore: number
  ): { grade: string; color: string; emoji: string } => {
    if (averageScore >= 90) return { grade: 'S', color: 'text-yellow-400', emoji: '🌟' };
    if (averageScore >= 80) return { grade: 'A', color: 'text-green-400', emoji: '🎯' };
    if (averageScore >= 70) return { grade: 'B', color: 'text-blue-400', emoji: '👍' };
    if (averageScore >= 60) return { grade: 'C', color: 'text-orange-400', emoji: '👌' };
    if (averageScore >= 50) return { grade: 'D', color: 'text-red-400', emoji: '📈' };
    return { grade: 'F', color: 'text-gray-400', emoji: '💪' };
  };

  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-white/20 text-center">
        <div className="mb-4">
          {results.winner === currentPlayerId ? (
            <div className="text-6xl mb-2">🎉</div>
          ) : (
            <div className="text-6xl mb-2">🏁</div>
          )}

          <h2 className="text-3xl font-bold text-white mb-2">
            {results.winner === currentPlayerId ? 'Congratulations!' : 'Game Complete!'}
          </h2>

          {results.winner === currentPlayerId ? (
            <p className="text-xl text-yellow-300">You won the game! 🏆</p>
          ) : currentPlayerRanking ? (
            <p className="text-lg text-white/80">
              You finished in {getPositionSuffix(currentPlayerRanking.position)} place
            </p>
          ) : (
            <p className="text-lg text-white/80">Thanks for playing!</p>
          )}
        </div>

        {/* Current Player Summary */}
        {currentPlayerRanking && currentPlayerStats && (
          <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {getMedalEmoji(currentPlayerRanking.position)}{' '}
                  {getPositionSuffix(currentPlayerRanking.position)}
                </div>
                <div className="text-sm text-white/60">Final Position</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {currentPlayerRanking.totalScore}
                </div>
                <div className="text-sm text-white/60">Total Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {formatScore(currentPlayerStats.averageScore)}
                </div>
                <div className="text-sm text-white/60">Average Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {formatTime(currentPlayerStats.totalTime)}
                </div>
                <div className="text-sm text-white/60">Total Time</div>
              </div>
            </div>
          </div>
        )}

        {/* Game Info */}
        <div className="flex justify-center gap-4 text-sm text-white/60">
          <span
            className={`px-3 py-1 rounded ${
              results.gameMode === 'multiplayer'
                ? 'bg-blue-500/30 text-blue-200'
                : 'bg-green-500/30 text-green-200'
            }`}
          >
            {results.gameMode === 'multiplayer' ? '👥 Multiplayer' : '👤 Single Player'}
          </span>
          {results.theme && (
            <span className="bg-blue-500/30 text-blue-200 px-3 py-1 rounded">
              🎭 {results.theme}
            </span>
          )}
          <span className="bg-gray-500/30 text-gray-200 px-3 py-1 rounded">
            🕒 {new Date(results.completedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* View Tabs */}
      <div className="p-4 border-b border-white/20">
        <div className="flex gap-2 justify-center">
          {(['rankings', 'statistics', 'performance'] as ResultsView[]).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                activeView === view
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {view === 'rankings' && '🏆 Rankings'}
              {view === 'statistics' && '📊 Statistics'}
              {view === 'performance' && '⭐ Performance'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Rankings View */}
        {activeView === 'rankings' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Final Rankings</h3>
            {results.rankings.map((ranking, index) => (
              <div
                key={ranking.playerId}
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  ranking.playerId === currentPlayerId
                    ? 'bg-gradient-to-r from-blue-600/30 to-blue-500/30 border border-blue-400/50'
                    : index === 0
                      ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
                      : index === 1
                        ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border border-gray-400/30'
                        : index === 2
                          ? 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border border-amber-600/30'
                          : 'bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      index === 0
                        ? 'bg-yellow-500 text-yellow-900'
                        : index === 1
                          ? 'bg-gray-400 text-gray-900'
                          : index === 2
                            ? 'bg-amber-600 text-amber-900'
                            : 'bg-white/20 text-white'
                    }`}
                  >
                    {getMedalEmoji(ranking.position)}
                  </div>

                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      {ranking.username}
                      {ranking.playerId === currentPlayerId && (
                        <span className="text-xs bg-blue-500/50 text-blue-200 px-2 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-white/60">
                      {getPositionSuffix(ranking.position)} place
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-white text-lg">{ranking.totalScore}</div>
                  <div className="text-sm text-white/60">{formatTime(ranking.completionTime)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Statistics View */}
        {activeView === 'statistics' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Detailed Statistics
            </h3>
            {results.statistics.map((stats) => {
              const ranking = results.rankings.find((r) => r.playerId === stats.playerId);
              const performance = getPerformanceGrade(stats.averageScore);

              return (
                <div
                  key={stats.playerId}
                  className={`p-4 rounded-lg ${
                    stats.playerId === currentPlayerId
                      ? 'bg-gradient-to-r from-blue-600/30 to-blue-500/30 border border-blue-400/50'
                      : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {ranking?.username || `Player ${stats.playerId}`}
                      </span>
                      {stats.playerId === currentPlayerId && (
                        <span className="text-xs bg-blue-500/50 text-blue-200 px-2 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 ${performance.color}`}>
                      <span>{performance.emoji}</span>
                      <span className="font-bold text-lg">{performance.grade}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-400">
                        {formatScore(stats.averageScore)}
                      </div>
                      <div className="text-xs text-white/60">Avg Score</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-400">{stats.doorsCompleted}</div>
                      <div className="text-xs text-white/60">Doors</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-400">
                        {formatTime(stats.totalTime)}
                      </div>
                      <div className="text-xs text-white/60">Time</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Performance View */}
        {activeView === 'performance' && currentPlayerStats && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Your Performance Analysis
            </h3>

            {/* Performance Grade */}
            <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 rounded-lg p-6 text-center">
              <div className="text-6xl mb-2">
                {getPerformanceGrade(currentPlayerStats.averageScore).emoji}
              </div>
              <div
                className={`text-4xl font-bold mb-2 ${getPerformanceGrade(currentPlayerStats.averageScore).color}`}
              >
                Grade: {getPerformanceGrade(currentPlayerStats.averageScore).grade}
              </div>
              <div className="text-white/80">
                Average Score: {formatScore(currentPlayerStats.averageScore)}
              </div>
            </div>

            {/* Performance Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">🎯 Scoring Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/70">Average Score:</span>
                    <span className="text-white font-semibold">
                      {formatScore(currentPlayerStats.averageScore)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Total Doors:</span>
                    <span className="text-white font-semibold">
                      {currentPlayerStats.doorsCompleted}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Score per Door:</span>
                    <span className="text-white font-semibold">
                      {formatScore(
                        currentPlayerRanking
                          ? currentPlayerRanking.totalScore / currentPlayerStats.doorsCompleted
                          : 0
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">⏱️ Time Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/70">Total Time:</span>
                    <span className="text-white font-semibold">
                      {formatTime(currentPlayerStats.totalTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Time per Door:</span>
                    <span className="text-white font-semibold">
                      {formatDuration(
                        (parseInt(currentPlayerStats.totalTime) || 0) /
                          currentPlayerStats.doorsCompleted
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Final Position:</span>
                    <span className="text-white font-semibold">
                      {currentPlayerRanking
                        ? getPositionSuffix(currentPlayerRanking.position)
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Tips */}
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-200 mb-2">💡 Performance Tips</h4>
              <div className="text-blue-100 text-sm space-y-1">
                {currentPlayerStats.averageScore < 60 && (
                  <p>• Try to be more creative and detailed in your responses</p>
                )}
                {currentPlayerStats.averageScore >= 60 && currentPlayerStats.averageScore < 80 && (
                  <p>• Great job! Try adding more humor or unique perspectives</p>
                )}
                {currentPlayerStats.averageScore >= 80 && (
                  <p>
                    • Excellent performance! You're mastering the art of creative problem-solving
                  </p>
                )}
                <p>• Consider the feasibility of your solutions alongside creativity</p>
                <p>• Take your time to craft thoughtful responses</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-6 border-t border-white/20">
        <div className="flex flex-wrap gap-3 justify-center">
          {onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              🎮 Play Again
            </button>
          )}

          {onViewLeaderboard && (
            <button
              onClick={onViewLeaderboard}
              className="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-800 hover:to-blue-900 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              🏆 View Leaderboard
            </button>
          )}

          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              🏠 Back to Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
