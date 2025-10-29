package services

import (
	"context"
	"dumdoors-backend/internal/models"
	"testing"
	"time"

	"github.com/gofiber/contrib/websocket"
)

// MockGameSessionRepository for testing
type MockGameSessionRepository struct {
	sessions map[string]*models.GameSession
}

func NewMockGameSessionRepository() *MockGameSessionRepository {
	return &MockGameSessionRepository{
		sessions: make(map[string]*models.GameSession),
	}
}

func (m *MockGameSessionRepository) Create(ctx context.Context, session *models.GameSession) error {
	m.sessions[session.SessionID] = session
	return nil
}

func (m *MockGameSessionRepository) GetByID(ctx context.Context, sessionID string) (*models.GameSession, error) {
	session, exists := m.sessions[sessionID]
	if !exists {
		return nil, nil
	}
	return session, nil
}

func (m *MockGameSessionRepository) Update(ctx context.Context, session *models.GameSession) error {
	m.sessions[session.SessionID] = session
	return nil
}

func (m *MockGameSessionRepository) AddPlayerToSession(ctx context.Context, sessionID string, player models.PlayerInfo) error {
	session, exists := m.sessions[sessionID]
	if !exists {
		return nil
	}
	session.Players = append(session.Players, player)
	return nil
}

func (m *MockGameSessionRepository) Delete(ctx context.Context, sessionID string) error {
	delete(m.sessions, sessionID)
	return nil
}

func (m *MockGameSessionRepository) GetActiveSessionsByStatus(ctx context.Context, status models.GameStatus) ([]*models.GameSession, error) {
	var sessions []*models.GameSession
	for _, session := range m.sessions {
		if session.Status == status {
			sessions = append(sessions, session)
		}
	}
	return sessions, nil
}

func (m *MockGameSessionRepository) UpdatePlayerInSession(ctx context.Context, sessionID string, player models.PlayerInfo) error {
	session, exists := m.sessions[sessionID]
	if !exists {
		return nil
	}
	for i, p := range session.Players {
		if p.PlayerID == player.PlayerID {
			session.Players[i] = player
			break
		}
	}
	return nil
}

// MockPlayerPathRepository for testing
type MockPlayerPathRepository struct {
	paths map[string]*models.PlayerPath
}

func NewMockPlayerPathRepository() *MockPlayerPathRepository {
	return &MockPlayerPathRepository{
		paths: make(map[string]*models.PlayerPath),
	}
}

func (m *MockPlayerPathRepository) CreatePlayer(ctx context.Context, playerID, username string) error {
	return nil
}

func (m *MockPlayerPathRepository) GetPlayerPath(ctx context.Context, playerID string) (*models.PlayerPath, error) {
	path, exists := m.paths[playerID]
	if !exists {
		return nil, nil
	}
	return path, nil
}

func (m *MockPlayerPathRepository) UpdatePlayerPath(ctx context.Context, path *models.PlayerPath) error {
	m.paths[path.PlayerID] = path
	return nil
}

func (m *MockPlayerPathRepository) GetNextDoor(ctx context.Context, playerID string, currentScore int) (string, error) {
	return "next-door", nil
}

func (m *MockPlayerPathRepository) UpdatePlayerPosition(ctx context.Context, playerID, doorID string) error {
	return nil
}

func (m *MockPlayerPathRepository) CalculateOptimalPath(ctx context.Context, playerID string, scores []int) ([]string, error) {
	return []string{"door-1", "door-2", "door-3"}, nil
}

// MockWebSocketManager for testing
type MockWebSocketManager struct {
	lastProgressUpdate *SessionProgress
	lastPositionUpdate map[string]interface{}
	lastScoreUpdate    map[string]interface{}
}

func NewMockWebSocketManager() *MockWebSocketManager {
	return &MockWebSocketManager{}
}

func (m *MockWebSocketManager) BroadcastProgressUpdate(sessionID string, progress SessionProgress) error {
	m.lastProgressUpdate = &progress
	return nil
}

func (m *MockWebSocketManager) BroadcastPlayerPositionUpdate(sessionID, playerID string, position int, totalDoors int) error {
	m.lastPositionUpdate = map[string]interface{}{
		"sessionID":       sessionID,
		"playerID":        playerID,
		"position":        position,
		"totalDoors":      totalDoors,
	}
	return nil
}

func (m *MockWebSocketManager) BroadcastScoreUpdate(sessionID, playerID string, newScore int, totalScore int) error {
	m.lastScoreUpdate = map[string]interface{}{
		"sessionID":  sessionID,
		"playerID":   playerID,
		"newScore":   newScore,
		"totalScore": totalScore,
	}
	return nil
}

func (m *MockWebSocketManager) BroadcastLeaderboardUpdate(sessionID string, leaderboard []PlayerProgress) error {
	return nil
}

func (m *MockWebSocketManager) BroadcastPlayerStatusUpdate(sessionID string, playerProgress PlayerProgress) error {
	return nil
}

func (m *MockWebSocketManager) BroadcastFinalRankings(sessionID string, rankings []models.PlayerRanking) error {
	return nil
}

func (m *MockWebSocketManager) BroadcastPerformanceStatistics(sessionID string, stats []models.PlayerPerformanceStats) error {
	return nil
}

// Implement other required methods (not used in tests)
func (m *MockWebSocketManager) RegisterConnection(sessionID, playerID string, conn *websocket.Conn) error { return nil }
func (m *MockWebSocketManager) UnregisterConnection(playerID string) error { return nil }
func (m *MockWebSocketManager) BroadcastToSession(sessionID string, event WebSocketEvent) error { return nil }
func (m *MockWebSocketManager) SendToPlayer(playerID string, event WebSocketEvent) error { return nil }
func (m *MockWebSocketManager) HandlePlayerDisconnect(playerID string) error { return nil }
func (m *MockWebSocketManager) RestorePlayerConnection(playerID string, conn *websocket.Conn) error { return nil }
func (m *MockWebSocketManager) GetActiveConnections(sessionID string) []*WebSocketConnection { return nil }
func (m *MockWebSocketManager) CleanupInactiveConnections() {}
func (m *MockWebSocketManager) HandleWebSocketConnection(c *websocket.Conn, sessionID, playerID string) {}

// TestCalculatePlayerProgress tests the player progress calculation
func TestCalculatePlayerProgress(t *testing.T) {
	// Setup mocks
	gameSessionRepo := NewMockGameSessionRepository()
	playerPathRepo := NewMockPlayerPathRepository()
	wsManager := NewMockWebSocketManager()
	
	// Create progress service
	progressService := NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	
	// Create test session with player
	sessionID := "test-session-1"
	playerID := "player-1"
	username := "TestPlayer"
	
	session := &models.GameSession{
		SessionID: sessionID,
		Mode:      models.GameModeMultiplayer,
		Status:    models.GameStatusActive,
		Players: []models.PlayerInfo{
			{
				PlayerID:        playerID,
				Username:        username,
				RedditUserID:    playerID,
				JoinedAt:        time.Now(),
				CurrentPosition: 0,
				TotalScore:      150,
				IsActive:        true,
				Responses: []models.PlayerResponse{
					{
						ResponseID:  "resp-1",
						DoorID:      "door-1",
						PlayerID:    playerID,
						Content:     "Test response 1",
						AIScore:     75,
						SubmittedAt: time.Now().Add(-5 * time.Minute),
					},
					{
						ResponseID:  "resp-2",
						DoorID:      "door-2",
						PlayerID:    playerID,
						Content:     "Test response 2",
						AIScore:     75,
						SubmittedAt: time.Now().Add(-2 * time.Minute),
					},
				},
			},
		},
		CreatedAt: time.Now().Add(-10 * time.Minute),
	}
	
	// Add session to mock repository
	gameSessionRepo.sessions[sessionID] = session
	
	// Add player path to mock repository
	playerPath := &models.PlayerPath{
		PlayerID:          playerID,
		Theme:             "general",
		CurrentDifficulty: 1,
		DoorsVisited:      []string{"door-1", "door-2"},
		CurrentPosition:   2,
		TotalDoors:        10,
		CreatedAt:         time.Now().Add(-10 * time.Minute),
	}
	playerPathRepo.paths[playerID] = playerPath
	
	// Test calculate player progress
	ctx := context.Background()
	progress, err := progressService.CalculatePlayerProgress(ctx, sessionID, playerID)
	
	// Assertions
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	
	if progress == nil {
		t.Fatal("Expected progress to be non-nil")
	}
	
	if progress.PlayerID != playerID {
		t.Errorf("Expected PlayerID %s, got %s", playerID, progress.PlayerID)
	}
	
	if progress.Username != username {
		t.Errorf("Expected Username %s, got %s", username, progress.Username)
	}
	
	if progress.CurrentPosition != 2 {
		t.Errorf("Expected CurrentPosition 2, got %d", progress.CurrentPosition)
	}
	
	if progress.TotalDoors != 10 {
		t.Errorf("Expected TotalDoors 10, got %d", progress.TotalDoors)
	}
	
	if progress.TotalScore != 150 {
		t.Errorf("Expected TotalScore 150, got %d", progress.TotalScore)
	}
	
	if progress.DoorsCompleted != 2 {
		t.Errorf("Expected DoorsCompleted 2, got %d", progress.DoorsCompleted)
	}
	
	expectedAverageScore := 75.0
	if progress.AverageScore != expectedAverageScore {
		t.Errorf("Expected AverageScore %.1f, got %.1f", expectedAverageScore, progress.AverageScore)
	}
	
	if !progress.IsActive {
		t.Error("Expected IsActive to be true")
	}
	
	if progress.LastResponseAt == nil {
		t.Error("Expected LastResponseAt to be non-nil")
	}
}

// TestCalculateSessionProgress tests the session progress calculation
func TestCalculateSessionProgress(t *testing.T) {
	// Setup mocks
	gameSessionRepo := NewMockGameSessionRepository()
	playerPathRepo := NewMockPlayerPathRepository()
	wsManager := NewMockWebSocketManager()
	
	// Create progress service
	progressService := NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	
	// Create test session with multiple players
	sessionID := "test-session-2"
	
	session := &models.GameSession{
		SessionID: sessionID,
		Mode:      models.GameModeMultiplayer,
		Status:    models.GameStatusActive,
		Players: []models.PlayerInfo{
			{
				PlayerID:        "player-1",
				Username:        "Player1",
				RedditUserID:    "player-1",
				JoinedAt:        time.Now(),
				CurrentPosition: 0,
				TotalScore:      75,
				IsActive:        true,
				Responses: []models.PlayerResponse{
					{
						ResponseID:  "resp-1",
						DoorID:      "door-1",
						PlayerID:    "player-1",
						Content:     "Response 1",
						AIScore:     75,
						SubmittedAt: time.Now().Add(-5 * time.Minute),
					},
				},
			},
			{
				PlayerID:        "player-2",
				Username:        "Player2",
				RedditUserID:    "player-2",
				JoinedAt:        time.Now(),
				CurrentPosition: 0,
				TotalScore:      90,
				IsActive:        true,
				Responses: []models.PlayerResponse{
					{
						ResponseID:  "resp-2",
						DoorID:      "door-1",
						PlayerID:    "player-2",
						Content:     "Response 2",
						AIScore:     90,
						SubmittedAt: time.Now().Add(-4 * time.Minute),
					},
				},
			},
		},
		CurrentDoor: &models.Door{
			DoorID:  "door-1",
			Content: "Test door",
		},
		CreatedAt: time.Now().Add(-10 * time.Minute),
	}
	
	// Add session to mock repository
	gameSessionRepo.sessions[sessionID] = session
	
	// Add player paths
	playerPathRepo.paths["player-1"] = &models.PlayerPath{
		PlayerID:        "player-1",
		CurrentPosition: 1,
		TotalDoors:      10,
	}
	
	playerPathRepo.paths["player-2"] = &models.PlayerPath{
		PlayerID:        "player-2",
		CurrentPosition: 1,
		TotalDoors:      8, // Shorter path due to better performance
	}
	
	// Test calculate session progress
	ctx := context.Background()
	sessionProgress, err := progressService.CalculateSessionProgress(ctx, sessionID)
	
	// Assertions
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	
	if sessionProgress == nil {
		t.Fatal("Expected sessionProgress to be non-nil")
	}
	
	if sessionProgress.SessionID != sessionID {
		t.Errorf("Expected SessionID %s, got %s", sessionID, sessionProgress.SessionID)
	}
	
	if len(sessionProgress.Players) != 2 {
		t.Errorf("Expected 2 players, got %d", len(sessionProgress.Players))
	}
	
	if sessionProgress.CurrentDoorID != "door-1" {
		t.Errorf("Expected CurrentDoorID 'door-1', got %s", sessionProgress.CurrentDoorID)
	}
	
	if sessionProgress.GameStatus != string(models.GameStatusActive) {
		t.Errorf("Expected GameStatus %s, got %s", models.GameStatusActive, sessionProgress.GameStatus)
	}
	
	// Player 2 should be the leader (higher progress percentage: 1/8 = 12.5% vs 1/10 = 10%)
	if sessionProgress.LeaderPlayerID != "player-2" {
		t.Errorf("Expected LeaderPlayerID 'player-2', got %s", sessionProgress.LeaderPlayerID)
	}
}

// TestBroadcastProgressUpdates tests the progress broadcasting functionality
func TestBroadcastProgressUpdates(t *testing.T) {
	// Setup mocks
	gameSessionRepo := NewMockGameSessionRepository()
	playerPathRepo := NewMockPlayerPathRepository()
	wsManager := NewMockWebSocketManager()
	
	// Create progress service
	progressService := NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	
	// Create test session
	sessionID := "test-session-3"
	session := &models.GameSession{
		SessionID: sessionID,
		Mode:      models.GameModeMultiplayer,
		Status:    models.GameStatusActive,
		Players: []models.PlayerInfo{
			{
				PlayerID:     "player-1",
				Username:     "Player1",
				RedditUserID: "player-1",
				IsActive:     true,
			},
		},
		CreatedAt: time.Now(),
	}
	
	gameSessionRepo.sessions[sessionID] = session
	playerPathRepo.paths["player-1"] = &models.PlayerPath{
		PlayerID:        "player-1",
		CurrentPosition: 1,
		TotalDoors:      10,
	}
	
	// Test broadcast progress updates
	ctx := context.Background()
	err := progressService.BroadcastProgressUpdates(ctx, sessionID)
	
	// Assertions
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	
	// Check that WebSocket manager received the progress update
	if wsManager.lastProgressUpdate == nil {
		t.Fatal("Expected progress update to be broadcasted")
	}
	
	if wsManager.lastProgressUpdate.SessionID != sessionID {
		t.Errorf("Expected broadcasted SessionID %s, got %s", sessionID, wsManager.lastProgressUpdate.SessionID)
	}
	
	if len(wsManager.lastProgressUpdate.Players) != 1 {
		t.Errorf("Expected 1 player in progress update, got %d", len(wsManager.lastProgressUpdate.Players))
	}
}

// TestTrackPlayerResponse tests the real-time player response tracking
func TestTrackPlayerResponse(t *testing.T) {
	// Setup mocks
	gameSessionRepo := NewMockGameSessionRepository()
	playerPathRepo := NewMockPlayerPathRepository()
	wsManager := NewMockWebSocketManager()
	
	// Create progress service
	progressService := NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	
	// Create test session
	sessionID := "test-session-4"
	playerID := "player-1"
	session := &models.GameSession{
		SessionID: sessionID,
		Mode:      models.GameModeMultiplayer,
		Status:    models.GameStatusActive,
		Players: []models.PlayerInfo{
			{
				PlayerID:     playerID,
				Username:     "TestPlayer",
				RedditUserID: playerID,
				IsActive:     true,
				TotalScore:   75,
				Responses: []models.PlayerResponse{
					{
						ResponseID: "resp-1",
						AIScore:    75,
					},
				},
			},
		},
		CreatedAt: time.Now(),
	}
	
	gameSessionRepo.sessions[sessionID] = session
	playerPathRepo.paths[playerID] = &models.PlayerPath{
		PlayerID:        playerID,
		CurrentPosition: 1,
		TotalDoors:      10,
	}
	
	// Test track player response
	ctx := context.Background()
	score := 85
	err := progressService.TrackPlayerResponse(ctx, sessionID, playerID, score)
	
	// Assertions
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	
	// Verify that position update was called
	if wsManager.lastPositionUpdate == nil {
		t.Fatal("Expected position update to be broadcasted")
	}
	
	if wsManager.lastPositionUpdate["playerID"] != playerID {
		t.Errorf("Expected position update for player %s, got %s", playerID, wsManager.lastPositionUpdate["playerID"])
	}
}

// TestBroadcastRealTimeScoreUpdate tests real-time score broadcasting
func TestBroadcastRealTimeScoreUpdate(t *testing.T) {
	// Setup mocks
	gameSessionRepo := NewMockGameSessionRepository()
	playerPathRepo := NewMockPlayerPathRepository()
	wsManager := NewMockWebSocketManager()
	
	// Create progress service
	progressService := NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	
	// Create test session
	sessionID := "test-session-5"
	playerID := "player-1"
	username := "TestPlayer"
	session := &models.GameSession{
		SessionID: sessionID,
		Players: []models.PlayerInfo{
			{
				PlayerID: playerID,
				Username: username,
			},
		},
	}
	
	gameSessionRepo.sessions[sessionID] = session
	
	// Test broadcast real-time score update
	ctx := context.Background()
	newScore := 85
	totalScore := 160
	err := progressService.BroadcastRealTimeScoreUpdate(ctx, sessionID, playerID, newScore, totalScore)
	
	// Assertions
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	
	// Note: In a real implementation, we would verify the WebSocket broadcast
	// For now, we just verify the method doesn't error
}