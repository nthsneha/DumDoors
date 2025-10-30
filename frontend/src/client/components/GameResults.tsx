import { useState, useEffect } from 'react';
import type { GameResults as GameResultsType } from '../../shared/types/api';

interface GameResultsProps {
  results: GameResultsType;
  currentPlayerId?: string;
  onPlayAgain?: () => void;
  onViewLeaderboard?: () => void;
  onBackToLobby?: () => void;
  className?: string;
}



export const GameResults = ({
  results,
  currentPlayerId,
  onPlayAgain,
  onViewLeaderboard,
  onBackToLobby,
  className = ''
}: GameResultsProps) => {
  const [showConfetti, setShowConfetti] = useState(false);

  // Find current player's ranking and stats
  const currentPlayerRanking = results.rankings.find(r => r.playerId === currentPlayerId);
  const currentPlayerStats = results.statistics.find(s => s.playerId === currentPlayerId);

  // Trigger confetti animation on mount
  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

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



  // Get performance grade based on average score
  const getPerformanceGrade = (averageScore: number): { grade: string; color: string; emoji: string } => {
    if (averageScore >= 90) return { grade: 'S', color: 'text-yellow-400', emoji: '🌟' };
    if (averageScore >= 80) return { grade: 'A', color: 'text-green-400', emoji: '🎯' };
    if (averageScore >= 70) return { grade: 'B', color: 'text-blue-400', emoji: '👍' };
    if (averageScore >= 60) return { grade: 'C', color: 'text-orange-400', emoji: '👌' };
    if (averageScore >= 50) return { grade: 'D', color: 'text-red-400', emoji: '📈' };
    return { grade: 'F', color: 'text-gray-400', emoji: '💪' };
  };

  return (
    <div className={`relative min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 overflow-hidden ${className}`}>
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            >
              {['🎉', '🎊', '⭐', '✨', '🌟', '💫'][Math.floor(Math.random() * 6)]}
            </div>
          ))}
        </div>
      )}

      {/* Funky Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400/20 rounded-full animate-pulse"></div>
        <div className="absolute top-32 right-20 w-24 h-24 bg-pink-400/20 rounded-full animate-bounce"></div>
        <div className="absolute bottom-20 left-32 w-40 h-40 bg-blue-400/20 rounded-full animate-ping"></div>
        <div className="absolute bottom-40 right-10 w-28 h-28 bg-green-400/20 rounded-full animate-pulse"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Funky Header */}
        <div className="text-center mb-8">
          <div className="text-8xl mb-4 animate-bounce">
            {currentPlayerStats && currentPlayerStats.averageScore >= 80 ? '🎉' :
              currentPlayerStats && currentPlayerStats.averageScore >= 60 ? '🎊' : '🏁'}
          </div>

          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 mb-4 animate-pulse">
            GAME OVER!
          </h1>

          <div className="text-2xl text-white font-bold mb-2">
            {currentPlayerStats && currentPlayerStats.averageScore >= 80 ? 'LEGENDARY PERFORMANCE! 🔥' :
              currentPlayerStats && currentPlayerStats.averageScore >= 60 ? 'SOLID WORK! 💪' :
                'NICE TRY! 🎯'}
          </div>
        </div>

        {/* Main Stats Card */}
        {currentPlayerRanking && currentPlayerStats && (
          <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-8 border-4 border-gradient-to-r from-yellow-400 to-pink-500 shadow-2xl max-w-2xl w-full mb-8">
            {/* Score Display */}
            <div className="text-center mb-8">
              <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-2">
                {Math.round(currentPlayerRanking.totalScore)}
              </div>
              <div className="text-2xl text-white font-bold">TOTAL SCORE</div>
              <div className="text-lg text-gray-300">
                Average: {formatScore(currentPlayerStats.averageScore)} per door
              </div>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Total Time */}
              <div className="bg-gradient-to-br from-blue-500/30 to-purple-600/30 rounded-2xl p-6 text-center border border-blue-400/50">
                <div className="text-4xl mb-2">⏱️</div>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatTime(currentPlayerStats.totalTime)}
                </div>
                <div className="text-sm text-gray-300">Total Time</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDuration((parseInt(currentPlayerStats.totalTime) || 0) / currentPlayerStats.doorsCompleted)} per door
                </div>
              </div>

              {/* Doors Completed */}
              <div className="bg-gradient-to-br from-green-500/30 to-teal-600/30 rounded-2xl p-6 text-center border border-green-400/50">
                <div className="text-4xl mb-2">🚪</div>
                <div className="text-3xl font-bold text-white mb-1">
                  {currentPlayerStats.doorsCompleted}
                </div>
                <div className="text-sm text-gray-300">Doors Completed</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatScore(currentPlayerRanking.totalScore / currentPlayerStats.doorsCompleted)} avg score
                </div>
              </div>
            </div>

            {/* Performance Grade */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-6 text-center border border-yellow-400/50">
              <div className="text-5xl mb-2">{getPerformanceGrade(currentPlayerStats.averageScore).emoji}</div>
              <div className={`text-4xl font-black mb-2 ${getPerformanceGrade(currentPlayerStats.averageScore).color}`}>
                GRADE: {getPerformanceGrade(currentPlayerStats.averageScore).grade}
              </div>
              <div className="text-white/80">
                {currentPlayerStats.averageScore >= 90 ? 'ABSOLUTELY LEGENDARY!' :
                  currentPlayerStats.averageScore >= 80 ? 'EXCELLENT WORK!' :
                    currentPlayerStats.averageScore >= 70 ? 'GREAT JOB!' :
                      currentPlayerStats.averageScore >= 60 ? 'GOOD EFFORT!' :
                        currentPlayerStats.averageScore >= 50 ? 'KEEP TRYING!' : 'ROOM FOR IMPROVEMENT!'}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          {onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-xl hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 transition-all duration-300 shadow-2xl border-2 border-green-400/50 hover:shadow-green-500/50"
            >
              🎮 PLAY AGAIN
            </button>
          )}

          {onViewLeaderboard && (
            <button
              onClick={onViewLeaderboard}
              className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-8 py-4 rounded-2xl font-black text-xl hover:from-yellow-600 hover:to-orange-700 transform hover:scale-110 transition-all duration-300 shadow-2xl border-2 border-yellow-400/50 hover:shadow-yellow-500/50"
            >
              🏆 LEADERBOARD
            </button>
          )}

          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-8 py-4 rounded-2xl font-black text-xl hover:from-purple-600 hover:to-pink-700 transform hover:scale-110 transition-all duration-300 shadow-2xl border-2 border-purple-400/50 hover:shadow-purple-500/50"
            >
              🏠 MAIN MENU
            </button>
          )}
        </div>

        {/* Fun Footer */}
        <div className="mt-8 text-center">
          <div className="text-white/60 text-sm">
            Thanks for playing DumDoors! 🎪
          </div>
        </div>
      </div>
    </div>
  );
};