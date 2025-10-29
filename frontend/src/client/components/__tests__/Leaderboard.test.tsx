import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Leaderboard } from '../Leaderboard';

// Mock fetch globally
global.fetch = vi.fn();

describe('Leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    // Mock fetch to return a pending promise
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));

    render(<Leaderboard />);
    
    // Should show loading skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    // Mock fetch to reject
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<Leaderboard />);
    
    // Wait for error state
    await screen.findByText(/Error Loading Leaderboard/i);
    expect(screen.getByText(/Network error/i)).toBeInTheDocument();
  });

  it('renders leaderboard data when loaded successfully', async () => {
    // Mock successful API responses
    const mockLeaderboard = {
      fastestCompletions: [
        {
          id: '1',
          playerId: 'player1',
          username: 'TestUser',
          redditUserId: 'reddit1',
          completionTime: 120000, // 2 minutes
          totalScore: 250,
          averageScore: 83.3,
          doorsCompleted: 3,
          gameMode: 'multiplayer' as const,
          sessionId: 'session1',
          completedAt: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ],
      highestAverages: [],
      mostCompleted: [],
      recentWinners: []
    };

    const mockStats = {
      totalGamesCompleted: 100,
      averageCompletionTime: 300000, // 5 minutes
      fastestEverTime: 90000, // 1.5 minutes
      highestEverAverage: 95.5,
      mostActivePlayer: 'TestUser',
      lastUpdated: '2024-01-01T00:00:00Z'
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLeaderboard)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      });

    render(<Leaderboard />);
    
    // Wait for data to load by looking for the header text with emoji
    await screen.findByText((content, element) => {
      return element?.textContent === '🏆 Global Leaderboard';
    });
    
    // Check if stats are displayed
    expect(screen.getByText('100')).toBeInTheDocument(); // Total games
    expect(screen.getByText('1m 30s')).toBeInTheDocument(); // Fastest time
    
    // Check if leaderboard entry is displayed
    expect(screen.getByText('TestUser')).toBeInTheDocument();
  });
});