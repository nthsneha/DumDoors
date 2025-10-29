package services

import (
	"context"
	"dumdoors-backend/internal/models"
	"testing"
	"time"
)



// TestLeaderboardService tests the leaderboard service functionality
func TestLeaderboardService(t *testing.T) {
	// Setup mocks
	leaderboardRepo := NewMockLeaderboardRepository()
	gameSessionRepo := NewMockGameSessionRepository()
	
	// Create leaderboard service
	leaderboardService := NewLeaderboardService(leaderboardRepo, gameSessionRepo)
	
	// Create test session with completed game
	sessionID := "test-session-leaderboard"
	playerID := "player-test"
	username := "TestPlayer"
	
	session := &models.GameSession{
		SessionID: sessionID,
		Mode:      models.GameModeMultiplayer,
		Status:    models.GameStatusCompleted,
		Players: []models.PlayerInfo{
			{
				PlayerID:     playerID,
				Username:     username,
				RedditUserID: "reddit-user-123",
				TotalScore:   250,
				Responses: []models.PlayerResponse{
					{
						ResponseID: "resp-1",
						AIScore:    80,
						Content:    "Great response",
					},
					{
						ResponseID: "resp-2", 
						AIScore:    90,
						Content:    "Another great response",
					},
				},
			},
		},
		StartedAt:   &[]time.Time{time.Now().Add(-10 * time.Minute)}[0],
		CompletedAt: &[]time.Time{time.Now()}[0],
	}
	
	// Add session to mock repository
	gameSessionRepo.sessions[sessionID] = session
	
	ctx := context.Background()
	
	// Test recording game completion
	err := leaderboardService.RecordGameCompletion(ctx, sessionID, playerID)
	if err != nil {
		t.Fatalf("Expected no error recording game completion, got: %v", err)
	}
	
	// Verify entry was added
	if len(leaderboardRepo.entries) != 1 {
		t.Fatalf("Expected 1 leaderboard entry, got: %d", len(leaderboardRepo.entries))
	}
	
	entry := leaderboardRepo.entries[0]
	if entry.PlayerID != playerID {
		t.Errorf("Expected PlayerID %s, got %s", playerID, entry.PlayerID)
	}
	
	if entry.Username != username {
		t.Errorf("Expected Username %s, got %s", username, entry.Username)
	}
	
	if entry.TotalScore != 250 {
		t.Errorf("Expected TotalScore 250, got %d", entry.TotalScore)
	}
	
	expectedAverage := 85.0 // (80 + 90) / 2
	if entry.AverageScore != expectedAverage {
		t.Errorf("Expected AverageScore %.1f, got %.1f", expectedAverage, entry.AverageScore)
	}
	
	if entry.DoorsCompleted != 2 {
		t.Errorf("Expected DoorsCompleted 2, got %d", entry.DoorsCompleted)
	}
	
	// Test getting global leaderboard
	filter := models.LeaderboardFilter{Limit: 10}
	leaderboard, err := leaderboardService.GetGlobalLeaderboard(ctx, filter)
	if err != nil {
		t.Fatalf("Expected no error getting global leaderboard, got: %v", err)
	}
	
	if len(leaderboard.FastestCompletions) != 1 {
		t.Errorf("Expected 1 fastest completion entry, got %d", len(leaderboard.FastestCompletions))
	}
	
	if len(leaderboard.HighestAverages) != 1 {
		t.Errorf("Expected 1 highest average entry, got %d", len(leaderboard.HighestAverages))
	}
	
	// Test getting leaderboard stats
	stats, err := leaderboardService.GetLeaderboardStats(ctx)
	if err != nil {
		t.Fatalf("Expected no error getting leaderboard stats, got: %v", err)
	}
	
	if stats.TotalGamesCompleted != 1 {
		t.Errorf("Expected TotalGamesCompleted 1, got %d", stats.TotalGamesCompleted)
	}
}

// TestLeaderboardFiltering tests leaderboard filtering functionality
func TestLeaderboardFiltering(t *testing.T) {
	// Setup mocks
	leaderboardRepo := NewMockLeaderboardRepository()
	gameSessionRepo := NewMockGameSessionRepository()
	
	// Create leaderboard service
	leaderboardService := NewLeaderboardService(leaderboardRepo, gameSessionRepo)
	
	ctx := context.Background()
	
	// Add test entries with different completion times and scores
	entries := []models.LeaderboardEntry{
		{
			PlayerID:       "player-1",
			Username:       "FastPlayer",
			CompletionTime: 5 * time.Minute,
			AverageScore:   75.0,
			DoorsCompleted: 3,
		},
		{
			PlayerID:       "player-2", 
			Username:       "SlowPlayer",
			CompletionTime: 15 * time.Minute,
			AverageScore:   95.0,
			DoorsCompleted: 5,
		},
		{
			PlayerID:       "player-3",
			Username:       "MediumPlayer", 
			CompletionTime: 10 * time.Minute,
			AverageScore:   85.0,
			DoorsCompleted: 4,
		},
	}
	
	for _, entry := range entries {
		leaderboardRepo.entries = append(leaderboardRepo.entries, entry)
	}
	
	// Test fastest completions (should be sorted by completion time)
	filter := models.LeaderboardFilter{Limit: 10}
	fastest, err := leaderboardService.GetFastestCompletions(ctx, filter)
	if err != nil {
		t.Fatalf("Expected no error getting fastest completions, got: %v", err)
	}
	
	if len(fastest) != 3 {
		t.Fatalf("Expected 3 entries, got %d", len(fastest))
	}
	
	// Should be sorted by completion time (ascending)
	if fastest[0].PlayerID != "player-1" {
		t.Errorf("Expected fastest player to be player-1, got %s", fastest[0].PlayerID)
	}
	
	if fastest[1].PlayerID != "player-3" {
		t.Errorf("Expected second fastest player to be player-3, got %s", fastest[1].PlayerID)
	}
	
	if fastest[2].PlayerID != "player-2" {
		t.Errorf("Expected slowest player to be player-2, got %s", fastest[2].PlayerID)
	}
	
	// Test highest averages (should be sorted by average score)
	highest, err := leaderboardService.GetHighestAverageScores(ctx, filter)
	if err != nil {
		t.Fatalf("Expected no error getting highest averages, got: %v", err)
	}
	
	if len(highest) != 3 {
		t.Fatalf("Expected 3 entries, got %d", len(highest))
	}
	
	// Should be sorted by average score (descending)
	if highest[0].PlayerID != "player-2" {
		t.Errorf("Expected highest average player to be player-2, got %s", highest[0].PlayerID)
	}
	
	if highest[1].PlayerID != "player-3" {
		t.Errorf("Expected second highest average player to be player-3, got %s", highest[1].PlayerID)
	}
	
	if highest[2].PlayerID != "player-1" {
		t.Errorf("Expected lowest average player to be player-1, got %s", highest[2].PlayerID)
	}
}