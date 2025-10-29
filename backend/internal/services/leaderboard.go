package services

import (
	"context"
	"dumdoors-backend/internal/models"
	"dumdoors-backend/internal/repositories"
	"fmt"
	"time"
)

// LeaderboardService interface defines leaderboard operations
type LeaderboardService interface {
	RecordGameCompletion(ctx context.Context, sessionID string, playerID string) error
	GetGlobalLeaderboard(ctx context.Context, filter models.LeaderboardFilter) (*models.GlobalLeaderboard, error)
	GetLeaderboardStats(ctx context.Context) (*models.LeaderboardStats, error)
	GetPlayerRank(ctx context.Context, playerID string, category string) (int, error)
	GetFastestCompletions(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error)
	GetHighestAverageScores(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error)
}

// LeaderboardServiceImpl implements the LeaderboardService interface
type LeaderboardServiceImpl struct {
	leaderboardRepo repositories.LeaderboardRepository
	gameSessionRepo repositories.GameSessionRepository
}

// NewLeaderboardService creates a new leaderboard service
func NewLeaderboardService(
	leaderboardRepo repositories.LeaderboardRepository,
	gameSessionRepo repositories.GameSessionRepository,
) LeaderboardService {
	return &LeaderboardServiceImpl{
		leaderboardRepo: leaderboardRepo,
		gameSessionRepo: gameSessionRepo,
	}
}

// RecordGameCompletion records a player's game completion for leaderboard tracking
func (s *LeaderboardServiceImpl) RecordGameCompletion(ctx context.Context, sessionID string, playerID string) error {
	// Get the game session to extract completion data
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session for leaderboard: %w", err)
	}
	
	if session == nil {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	
	// Find the player in the session
	var player *models.PlayerInfo
	for i := range session.Players {
		if session.Players[i].PlayerID == playerID {
			player = &session.Players[i]
			break
		}
	}
	
	if player == nil {
		return fmt.Errorf("player not found in session: %s", playerID)
	}
	
	// Calculate completion time
	var completionTime time.Duration
	if session.StartedAt != nil && session.CompletedAt != nil {
		completionTime = session.CompletedAt.Sub(*session.StartedAt)
	}
	
	// Calculate average score
	var averageScore float64
	if len(player.Responses) > 0 {
		totalScore := 0
		for _, response := range player.Responses {
			totalScore += response.AIScore
		}
		averageScore = float64(totalScore) / float64(len(player.Responses))
	}
	
	// Create leaderboard entry
	entry := &models.LeaderboardEntry{
		PlayerID:       player.PlayerID,
		Username:       player.Username,
		RedditUserID:   player.RedditUserID,
		CompletionTime: completionTime,
		TotalScore:     player.TotalScore,
		AverageScore:   averageScore,
		DoorsCompleted: len(player.Responses),
		GameMode:       session.Mode,
		Theme:          session.Theme,
		SessionID:      session.SessionID,
		CompletedAt:    time.Now(),
	}
	
	// Only record if the player actually completed doors
	if entry.DoorsCompleted > 0 {
		if err := s.leaderboardRepo.AddEntry(ctx, entry); err != nil {
			return fmt.Errorf("failed to add leaderboard entry: %w", err)
		}
	}
	
	return nil
}

// GetGlobalLeaderboard retrieves the global leaderboard with all categories
func (s *LeaderboardServiceImpl) GetGlobalLeaderboard(ctx context.Context, filter models.LeaderboardFilter) (*models.GlobalLeaderboard, error) {
	// Set default limit if not specified
	if filter.Limit <= 0 {
		filter.Limit = 10
	}
	
	// Ensure limit doesn't exceed maximum
	if filter.Limit > 100 {
		filter.Limit = 100
	}
	
	leaderboard, err := s.leaderboardRepo.GetGlobalLeaderboard(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to get global leaderboard: %w", err)
	}
	
	return leaderboard, nil
}

// GetLeaderboardStats retrieves aggregated leaderboard statistics
func (s *LeaderboardServiceImpl) GetLeaderboardStats(ctx context.Context) (*models.LeaderboardStats, error) {
	stats, err := s.leaderboardRepo.GetLeaderboardStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get leaderboard stats: %w", err)
	}
	
	return stats, nil
}

// GetPlayerRank retrieves a player's rank in a specific category
func (s *LeaderboardServiceImpl) GetPlayerRank(ctx context.Context, playerID string, category string) (int, error) {
	// Validate category
	validCategories := map[string]bool{
		"fastest":        true,
		"highest_avg":    true,
		"most_completed": true,
	}
	
	if !validCategories[category] {
		return 0, fmt.Errorf("invalid category: %s. Valid categories are: fastest, highest_avg, most_completed", category)
	}
	
	rank, err := s.leaderboardRepo.GetPlayerRank(ctx, playerID, category)
	if err != nil {
		return 0, fmt.Errorf("failed to get player rank: %w", err)
	}
	
	return rank, nil
}

// GetFastestCompletions retrieves the fastest completion times
func (s *LeaderboardServiceImpl) GetFastestCompletions(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Set default limit if not specified
	if filter.Limit <= 0 {
		filter.Limit = 10
	}
	
	entries, err := s.leaderboardRepo.GetFastestCompletions(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to get fastest completions: %w", err)
	}
	
	return entries, nil
}

// GetHighestAverageScores retrieves the highest average scores
func (s *LeaderboardServiceImpl) GetHighestAverageScores(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Set default limit if not specified
	if filter.Limit <= 0 {
		filter.Limit = 10
	}
	
	entries, err := s.leaderboardRepo.GetHighestAverageScores(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to get highest average scores: %w", err)
	}
	
	return entries, nil
}