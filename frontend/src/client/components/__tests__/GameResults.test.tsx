import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameResults } from '../GameResults';
import type { GameResults as GameResultsType } from '../../../shared/types/api';

const mockResults: GameResultsType = {
  winner: 'player1',
  rankings: [
    {
      playerId: 'player1',
      username: 'Winner',
      position: 1,
      totalScore: 300,
      completionTime: '180000' // 3 minutes in ms
    },
    {
      playerId: 'player2',
      username: 'Runner Up',
      position: 2,
      totalScore: 250,
      completionTime: '240000' // 4 minutes in ms
    }
  ],
  statistics: [
    {
      playerId: 'player1',
      averageScore: 85.5,
      doorsCompleted: 4,
      totalTime: '180000'
    },
    {
      playerId: 'player2',
      averageScore: 78.2,
      doorsCompleted: 4,
      totalTime: '240000'
    }
  ],
  sessionId: 'test-session',
  gameMode: 'multiplayer',
  completedAt: '2024-01-01T00:00:00Z'
};

describe('GameResults', () => {
  it('renders congratulations message for winner', () => {
    render(
      <GameResults 
        results={mockResults} 
        currentPlayerId="player1"
      />
    );
    
    expect(screen.getByText('Congratulations!')).toBeInTheDocument();
    expect(screen.getByText('You won the game! 🏆')).toBeInTheDocument();
  });

  it('renders completion message for non-winner', () => {
    render(
      <GameResults 
        results={mockResults} 
        currentPlayerId="player2"
      />
    );
    
    expect(screen.getByText('Game Complete!')).toBeInTheDocument();
    expect(screen.getByText('You finished in 2nd place')).toBeInTheDocument();
  });

  it('displays player rankings correctly', () => {
    render(
      <GameResults 
        results={mockResults} 
        currentPlayerId="player1"
      />
    );
    
    // Check if both players are shown in rankings
    expect(screen.getByText('Winner')).toBeInTheDocument();
    expect(screen.getByText('Runner Up')).toBeInTheDocument();
    
    // Check scores using getAllByText since scores appear in multiple places
    const scoreElements = screen.getAllByText('300');
    expect(scoreElements.length).toBeGreaterThan(0);
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it('switches between different views', () => {
    render(
      <GameResults 
        results={mockResults} 
        currentPlayerId="player1"
      />
    );
    
    // Click on Statistics tab
    fireEvent.click(screen.getByText('📊 Statistics'));
    expect(screen.getByText('Detailed Statistics')).toBeInTheDocument();
    
    // Click on Performance tab
    fireEvent.click(screen.getByText('⭐ Performance'));
    expect(screen.getByText('Your Performance Analysis')).toBeInTheDocument();
  });

  it('calls action handlers when buttons are clicked', () => {
    const onPlayAgain = vi.fn();
    const onViewLeaderboard = vi.fn();
    const onBackToLobby = vi.fn();
    
    render(
      <GameResults 
        results={mockResults} 
        currentPlayerId="player1"
        onPlayAgain={onPlayAgain}
        onViewLeaderboard={onViewLeaderboard}
        onBackToLobby={onBackToLobby}
      />
    );
    
    // Test action buttons
    fireEvent.click(screen.getByText('🎮 Play Again'));
    expect(onPlayAgain).toHaveBeenCalled();
    
    fireEvent.click(screen.getByText('🏆 View Leaderboard'));
    expect(onViewLeaderboard).toHaveBeenCalled();
    
    fireEvent.click(screen.getByText('🏠 Back to Lobby'));
    expect(onBackToLobby).toHaveBeenCalled();
  });

  it('displays performance grade correctly', () => {
    render(
      <GameResults 
        results={mockResults} 
        currentPlayerId="player1"
      />
    );
    
    // Switch to performance view
    fireEvent.click(screen.getByText('⭐ Performance'));
    
    // Should show grade A for 85.5 average score
    expect(screen.getByText('Grade: A')).toBeInTheDocument();
  });
});