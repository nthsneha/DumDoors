package services

import (
	"context"
	"dumdoors-backend/internal/models"
	"testing"
	"time"
)

// MockLeaderboardRepository implements LeaderboardRepository for testing
type MockLeaderboardRepository struct {
	entries []models.LeaderboardEntry
}

func NewMockLeaderboardRepository() *MockLeaderboardRepository {
	return &MockLeaderboardRepository{
		entries: make([]models.LeaderboardEntry, 0),
	}
}

func (m *MockLeaderboardRepository) AddEntry(ctx context.Context, entry *models.LeaderboardEntry) error {
	entry.CreatedAt = time.Now()
	m.entries = append(m.entries, *entry)
	return nil
}

func (m *MockLeaderboardRepository) GetFastestCompletions(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Sort by completion time (ascending)
	result := make([]models.LeaderboardEntry, len(m.entries))
	copy(result, m.entries)
	
	// Simple bubble sort for testing
	for i := 0; i < len(result)-1; i++ {
		for j := 0; j < len(result)-i-1; j++ {
			if result[j].CompletionTime > result[j+1].CompletionTime {
				result[j], result[j+1] = result[j+1], result[j]
			}
		}
	}
	
	if filter.Limit > 0 && len(result) > filter.Limit {
		result = result[:filter.Limit]
	}
	
	return result, nil
}

func (m *MockLeaderboardRepository) GetHighestAverageScores(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Sort by average score (descending)
	result := make([]models.LeaderboardEntry, len(m.entries))
	copy(result, m.entries)
	
	// Simple bubble sort for testing
	for i := 0; i < len(result)-1; i++ {
		for j := 0; j < len(result)-i-1; j++ {
			if result[j].AverageScore < result[j+1].AverageScore {
				result[j], result[j+1] = result[j+1], result[j]
			}
		}
	}
	
	if filter.Limit > 0 && len(result) > filter.Limit {
		result = result[:filter.Limit]
	}
	
	return result, nil
}

func (m *MockLeaderboardRepository) GetMostCompleted(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	return m.entries, nil
}

func (m *MockLeaderboardRepository) GetRecentWinners(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	return m.entries, nil
}

func (m *MockLeaderboardRepository) GetGlobalLeaderboard(ctx context.Context, filter models.LeaderboardFilter) (*models.GlobalLeaderboard, error) {
	fastest, _ := m.GetFastestCompletions(ctx, filter)
	highest, _ := m.GetHighestAverageScores(ctx, filter)
	
	return &models.GlobalLeaderboard{
		FastestCompletions: fastest,
		HighestAverages:    highest,
		MostCompleted:      m.entries,
		RecentWinners:      m.entries,
	}, nil
}

func (m *MockLeaderboardRepository) GetLeaderboardStats(ctx context.Context) (*models.LeaderboardStats, error) {
	return &models.LeaderboardStats{
		TotalGamesCompleted: len(m.entries),
		LastUpdated:         time.Now(),
	}, nil
}

func (m *MockLeaderboardRepository) GetPlayerRank(ctx context.Context, playerID string, category string) (int, error) {
	return 1, nil
}

// TestWinnerDetectionAndGameCompletion tests the complete winner detection and game completion flow
func TestWinnerDetectionAndGameCompletion(t *testing.T) {
	// Setup mocks
	gameSessionRepo := NewMockGameSessionRepository()
	playerPathRepo := NewMockPlayerPathRepository()
	wsManager := NewMockWebSocketManager()
	progressService := NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	
	// Create leaderboard service
	leaderboardRepo := NewMockLeaderboardRepository()
	leaderboardService := NewLeaderboardService(leaderboardRepo, gameSessionRepo)
	
	// Create game service
	gameService := NewGameService(gameSessionRepo, nil, playerPathRepo, wsManager, nil, progressService, leaderboardService)
	
	// Create test session with a player close to winning
	sessionID := "test-session-winner"
	playerID := "player-winner"
	username := "WinnerPlayer"
	
	session := &models.GameSession{
		SessionID: sessionID,
		Mode:      models.GameModeMultiplayer,
		Status:    models.GameStatusActive,
		Players: []models.PlayerInfo{
			{
				PlayerID:        playerID,
				Username:        username,
				RedditUserID:    playerID,
				JoinedAt:        time.Now().Add(-10 * time.Minute),
				CurrentPosition: 0,
				TotalScore:      450, // High score from 5 responses
				IsActive:        true,
				Responses: []models.PlayerResponse{
					{
						ResponseID:  "resp-1",
						DoorID:      "door-1",
						PlayerID:    playerID,
						Content:     "Great response 1",
						AIScore:     90,
						SubmittedAt: time.Now().Add(-8 * time.Minute),
						ScoringMetrics: models.ScoringMetrics{
							Creativity:  90,
							Feasibility: 85,
							Humor:       95,
							Originality: 90,
						},
					},
					{
						ResponseID:  "resp-2",
						DoorID:      "door-2",
						PlayerID:    playerID,
						Content:     "Great response 2",
						AIScore:     85,
						SubmittedAt: time.Now().Add(-6 * time.Minute),
						ScoringMetrics: models.ScoringMetrics{
							Creativity:  85,
							Feasibility: 80,
							Humor:       90,
							Originality: 85,
						},
					},
					{
						ResponseID:  "resp-3",
						DoorID:      "door-3",
						PlayerID:    playerID,
						Content:     "Great response 3",
						AIScore:     95,
						SubmittedAt: time.Now().Add(-4 * time.Minute),
						ScoringMetrics: models.ScoringMetrics{
							Creativity:  95,
							Feasibility: 90,
							Humor:       100,
							Originality: 95,
						},
					},
					{
						ResponseID:  "resp-4",
						DoorID:      "door-4",
						PlayerID:    playerID,
						Content:     "Great response 4",
						AIScore:     88,
						SubmittedAt: time.Now().Add(-2 * time.Minute),
						ScoringMetrics: models.ScoringMetrics{
							Creativity:  88,
							Feasibility: 85,
							Humor:       92,
							Originality: 87,
						},
					},
					{
						ResponseID:  "resp-5",
						DoorID:      "door-5",
						PlayerID:    playerID,
						Content:     "Final winning response",
						AIScore:     92,
						SubmittedAt: time.Now().Add(-1 * time.Minute),
						ScoringMetrics: models.ScoringMetrics{
							Creativity:  92,
							Feasibility: 88,
							Humor:       96,
							Originality: 90,
						},
					},
				},
			},
		},
		StartedAt: func() *time.Time { t := time.Now().Add(-10 * time.Minute); return &t }(),
		CreatedAt: time.Now().Add(-15 * time.Minute),
	}
	
	// Add session to mock repository
	gameSessionRepo.sessions[sessionID] = session
	
	// Create player path that indicates the player has completed their journey (5 doors total)
	playerPath := &models.PlayerPath{
		PlayerID:          playerID,
		Theme:             "general",
		CurrentDifficulty: 1,
		DoorsVisited:      []string{"door-1", "door-2", "door-3", "door-4", "door-5"},
		CurrentPosition:   5, // Completed all doors
		TotalDoors:        5, // Short path due to good performance
		CreatedAt:         time.Now().Add(-10 * time.Minute),
	}
	playerPathRepo.paths[playerID] = playerPath
	
	ctx := context.Background()
	
	// Test win condition check
	hasWon, err := gameService.(*GameServiceImpl).checkWinCondition(ctx, sessionID, playerID)
	if err != nil {
		t.Fatalf("Expected no error checking win condition, got: %v", err)
	}
	
	if !hasWon {
		t.Error("Expected player to have won, but checkWinCondition returned false")
	}
	
	// Test final rankings calculation
	finalRankings, err := gameService.(*GameServiceImpl).calculateFinalRankings(ctx, session)
	if err != nil {
		t.Fatalf("Expected no error calculating final rankings, got: %v", err)
	}
	
	if len(finalRankings) != 1 {
		t.Errorf("Expected 1 ranking, got %d", len(finalRankings))
	}
	
	if len(finalRankings) > 0 {
		ranking := finalRankings[0]
		
		if ranking.PlayerID != playerID {
			t.Errorf("Expected ranking for player %s, got %s", playerID, ranking.PlayerID)
		}
		
		if ranking.Rank != 1 {
			t.Errorf("Expected rank 1, got %d", ranking.Rank)
		}
		
		if !ranking.IsWinner {
			t.Error("Expected IsWinner to be true")
		}
		
		if ranking.CompletionTime == nil {
			t.Error("Expected CompletionTime to be set for winner")
		}
		
		if ranking.DoorsCompleted != 5 {
			t.Errorf("Expected 5 doors completed, got %d", ranking.DoorsCompleted)
		}
		
		if ranking.TotalDoors != 5 {
			t.Errorf("Expected 5 total doors, got %d", ranking.TotalDoors)
		}
		
		if ranking.CompletionRate != 100.0 {
			t.Errorf("Expected 100%% completion rate, got %.1f", ranking.CompletionRate)
		}
		
		expectedAverageScore := 90.0 // (90+85+95+88+92)/5
		if ranking.AverageScore != expectedAverageScore {
			t.Errorf("Expected average score %.1f, got %.1f", expectedAverageScore, ranking.AverageScore)
		}
	}
	
	// Test performance statistics calculation
	performanceStats, err := gameService.(*GameServiceImpl).calculatePerformanceStatistics(ctx, session)
	if err != nil {
		t.Fatalf("Expected no error calculating performance statistics, got: %v", err)
	}
	
	if len(performanceStats) != 1 {
		t.Errorf("Expected 1 performance stat, got %d", len(performanceStats))
	}
	
	if len(performanceStats) > 0 {
		stats := performanceStats[0]
		
		if stats.PlayerID != playerID {
			t.Errorf("Expected stats for player %s, got %s", playerID, stats.PlayerID)
		}
		
		if stats.TotalScore != 450 {
			t.Errorf("Expected total score 450, got %d", stats.TotalScore)
		}
		
		if stats.HighestScore != 95 {
			t.Errorf("Expected highest score 95, got %d", stats.HighestScore)
		}
		
		if stats.LowestScore != 85 {
			t.Errorf("Expected lowest score 85, got %d", stats.LowestScore)
		}
		
		if stats.DoorsCompleted != 5 {
			t.Errorf("Expected 5 doors completed, got %d", stats.DoorsCompleted)
		}
		
		if stats.CompletionRate != 100.0 {
			t.Errorf("Expected 100%% completion rate, got %.1f", stats.CompletionRate)
		}
		
		if stats.CompletionTime == nil {
			t.Error("Expected CompletionTime to be set")
		}
		
		// Check that creativity, feasibility, humor, and originality averages are calculated
		expectedCreativityAvg := 90.0 // (90+85+95+88+92)/5
		if stats.CreativityAverage != expectedCreativityAvg {
			t.Errorf("Expected creativity average %.1f, got %.1f", expectedCreativityAvg, stats.CreativityAverage)
		}
		
		// Path efficiency should be high (100%) since player completed with minimum doors (5)
		if stats.PathEfficiency != 100.0 {
			t.Errorf("Expected path efficiency 100%%, got %.1f", stats.PathEfficiency)
		}
	}
}

// TestGameCompletionFlow tests the complete game completion flow
func TestGameCompletionFlow(t *testing.T) {
	// Setup mocks
	gameSessionRepo := NewMockGameSessionRepository()
	playerPathRepo := NewMockPlayerPathRepository()
	wsManager := NewMockWebSocketManager()
	progressService := NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	
	// Create leaderboard service
	leaderboardRepo := NewMockLeaderboardRepository()
	leaderboardService := NewLeaderboardService(leaderboardRepo, gameSessionRepo)
	
	// Create game service
	gameService := NewGameService(gameSessionRepo, nil, playerPathRepo, wsManager, nil, progressService, leaderboardService)
	
	// Create test session
	sessionID := "test-completion-flow"
	playerID := "player-complete"
	
	session := &models.GameSession{
		SessionID: sessionID,
		Mode:      models.GameModeMultiplayer,
		Status:    models.GameStatusActive,
		Players: []models.PlayerInfo{
			{
				PlayerID:     playerID,
				Username:     "CompletePlayer",
				RedditUserID: playerID,
				IsActive:     true,
				TotalScore:   300,
				Responses: []models.PlayerResponse{
					{
						ResponseID: "resp-final",
						AIScore:    100,
						SubmittedAt: time.Now(),
					},
				},
			},
		},
		StartedAt: func() *time.Time { t := time.Now().Add(-5 * time.Minute); return &t }(),
		CreatedAt: time.Now().Add(-10 * time.Minute),
	}
	
	gameSessionRepo.sessions[sessionID] = session
	
	// Create completed player path
	playerPath := &models.PlayerPath{
		PlayerID:        playerID,
		CurrentPosition: 3,
		TotalDoors:      3, // Player has completed all doors
	}
	playerPathRepo.paths[playerID] = playerPath
	
	ctx := context.Background()
	
	// Test game completion handling
	err := gameService.(*GameServiceImpl).handleGameCompletion(ctx, sessionID, playerID)
	if err != nil {
		t.Fatalf("Expected no error handling game completion, got: %v", err)
	}
	
	// Verify session was marked as completed
	updatedSession, err := gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		t.Fatalf("Expected no error getting updated session, got: %v", err)
	}
	
	if updatedSession.Status != models.GameStatusCompleted {
		t.Errorf("Expected session status to be completed, got %s", updatedSession.Status)
	}
	
	if updatedSession.CompletedAt == nil {
		t.Error("Expected CompletedAt to be set")
	}
}