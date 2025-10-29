import React, { useState } from 'react';

interface RedditAdminPanelProps {
  onClose: () => void;
}

export const RedditAdminPanel: React.FC<RedditAdminPanelProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePostDailyLeaderboard = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/reddit/daily-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const result = await response.json();

      if (result.status === 'success') {
        setMessage(`✅ Daily leaderboard posted successfully! Post ID: ${result.postId}`);
      } else {
        setMessage(`ℹ️ ${result.message}`);
      }
    } catch (error) {
      setMessage('❌ Failed to post daily leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePostWeeklyLeaderboard = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/reddit/weekly-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const result = await response.json();

      if (result.status === 'success') {
        setMessage(`✅ Weekly leaderboard posted successfully! Post ID: ${result.postId}`);
      } else {
        setMessage(`ℹ️ ${result.message}`);
      }
    } catch (error) {
      setMessage('❌ Failed to post weekly leaderboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          >
            ✕
          </button>

          <h1 className="text-2xl font-bold mb-2">🤖 Reddit Admin Panel</h1>
          <p className="text-orange-200">Manage Reddit integration features</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="space-y-4">

            {/* Daily Leaderboard */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                📅 Daily Leaderboard
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                Post today's top performers to the subreddit
              </p>
              <button
                onClick={handlePostDailyLeaderboard}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition-colors w-full"
              >
                {loading ? '⏳ Posting...' : '📤 Post Daily Leaderboard'}
              </button>
            </div>

            {/* Weekly Leaderboard */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                📊 Weekly Leaderboard
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                Post this week's champions to the subreddit
              </p>
              <button
                onClick={handlePostWeeklyLeaderboard}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition-colors w-full"
              >
                {loading ? '⏳ Posting...' : '📤 Post Weekly Leaderboard'}
              </button>
            </div>

            {/* Message Display */}
            {message && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">{message}</p>
              </div>
            )}

            {/* Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-yellow-800 font-semibold mb-2">ℹ️ How it works:</h4>
              <ul className="text-yellow-700 text-sm space-y-1">
                <li>• Daily posts show today's top 10 players</li>
                <li>• Weekly posts show champions across all categories</li>
                <li>• Posts are automatically formatted for Reddit</li>
                <li>• Only posts if there are games to show</li>
              </ul>
            </div>
          </div>

          {/* Close Button */}
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              Close Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};