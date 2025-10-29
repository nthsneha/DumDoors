package services

import (
	"context"
	"dumdoors-backend/internal/models"
	"dumdoors-backend/internal/repositories"
	"fmt"
	"time"
)

// ProgressService interface defines the contract for progress tracking operations
type ProgressService interface {
	CalculatePlayerProgress(ctx context.Context, sessionID, playerID string) (*PlayerProgress, error)
	CalculateSessionProgress(ctx context.Context, sessionID string) (*SessionProgress, error)
	UpdatePlayerPosition(ctx context.Context, sessionID, playerID string) error
	BroadcastProgressUpdates(ctx context.Context, sessionID string) error
	GetLeaderboard(ctx context.Context, sessionID string) ([]PlayerProgress, error)
	TrackPlayerResponse(ctx context.Context, sessionID, playerID string, score int) error
	BroadcastRealTimeScoreUpdate(ctx context.Context, sessionID, playerID string, newScore, totalScore int) error
	GetRealTimeSessionStatus(ctx context.Context, sessionID string) (*SessionProgress, error)
	GetFinalRankings(ctx context.Context, sessionID string) ([]models.PlayerRanking, error)
	GetPerformanceStatistics(ctx context.Context, sessionID string) ([]models.PlayerPerformanceStats, error)
	BroadcastGameCompletion(ctx context.Context, sessionID, winnerID string, rankings []models.PlayerRanking, stats []models.PlayerPerformanceStats) error
}

// ProgressServiceImpl implements the ProgressService interface
type ProgressServiceImpl struct {
	gameSessionRepo repositories.GameSessionRepository
	playerPathRepo  repositories.PlayerPathRepository
	wsManager       WebSocketManager
}

// NewProgressService creates a new progress service instance
func NewProgressService(gameSessionRepo repositories.GameSessionRepository, playerPathRepo repositories.PlayerPathRepository, wsManager WebSocketManager) ProgressService {
	return &ProgressServiceImpl{
		gameSessionRepo: gameSessionRepo,
		playerPathRepo:  playerPathRepo,
		wsManager:       wsManager,
	}
}

// CalculatePlayerProgress calculates the current progress for a specific player
func (p *ProgressServiceImpl) CalculatePlayerProgress(ctx context.Context, sessionID, playerID string) (*PlayerProgress, error) {
	// Get the game session
	session, err := p.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return nil, fmt.Errorf("session not found")
	}
	
	// Find the player in the session
	var player *models.PlayerInfo
	for _, p := range session.Players {
		if p.PlayerID == playerID {
			player = &p
			break
		}
	}
	
	if player == nil {
		return nil, fmt.Errorf("player not found in session")
	}
	
	// Get player path from Neo4j
	playerPath, err := p.playerPathRepo.GetPlayerPath(ctx, playerID)
	if err != nil {
		// If no path exists, create default values
		playerPath = &models.PlayerPath{
			PlayerID:          playerID,
			Theme:             "general",
			CurrentDifficulty: 1,
			DoorsVisited:      []string{},
			CurrentPosition:   0,
			TotalDoors:        10, // Default path length
			CreatedAt:         time.Now(),
		}
	}
	
	// Calculate average score
	averageScore := 0.0
	doorsCompleted := len(player.Responses)
	if doorsCompleted > 0 {
		totalScore := 0
		for _, response := range player.Responses {
			totalScore += response.AIScore
		}
		averageScore = float64(totalScore) / float64(doorsCompleted)
	}
	
	// Get last response time
	var lastResponseAt *time.Time
	if doorsCompleted > 0 {
		lastResponseAt = &player.Responses[doorsCompleted-1].SubmittedAt
	}
	
	// Create progress object
	progress := &PlayerProgress{
		PlayerID:        player.PlayerID,
		Username:        player.Username,
		CurrentPosition: playerPath.CurrentPosition,
		TotalDoors:      playerPath.TotalDoors,
		TotalScore:      player.TotalScore,
		AverageScore:    averageScore,
		DoorsCompleted:  doorsCompleted,
		IsActive:        player.IsActive,
		LastResponseAt:  lastResponseAt,
	}
	
	return progress, nil
}

// CalculateSessionProgress calculates the progress for all players in a session
func (p *ProgressServiceImpl) CalculateSessionProgress(ctx context.Context, sessionID string) (*SessionProgress, error) {
	// Get the game session
	session, err := p.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return nil, fmt.Errorf("session not found")
	}
	
	// Calculate progress for each player
	var playersProgress []PlayerProgress
	var leaderPlayerID string
	maxProgress := -1.0
	
	for _, player := range session.Players {
		playerProgress, err := p.CalculatePlayerProgress(ctx, sessionID, player.PlayerID)
		if err != nil {
			// Log error but continue with other players
			fmt.Printf("Warning: failed to calculate progress for player %s: %v\n", player.PlayerID, err)
			continue
		}
		
		playersProgress = append(playersProgress, *playerProgress)
		
		// Determine leader based on progress percentage
		progressPercent := 0.0
		if playerProgress.TotalDoors > 0 {
			progressPercent = float64(playerProgress.CurrentPosition) / float64(playerProgress.TotalDoors) * 100
		}
		
		if progressPercent > maxProgress {
			maxProgress = progressPercent
			leaderPlayerID = player.PlayerID
		}
	}
	
	// Get current door ID
	currentDoorID := ""
	if session.CurrentDoor != nil {
		currentDoorID = session.CurrentDoor.DoorID
	}
	
	// Create session progress object
	sessionProgress := &SessionProgress{
		SessionID:      sessionID,
		Players:        playersProgress,
		CurrentDoorID:  currentDoorID,
		GameStatus:     string(session.Status),
		LeaderPlayerID: leaderPlayerID,
		UpdatedAt:      time.Now(),
	}
	
	return sessionProgress, nil
}

// UpdatePlayerPosition updates a player's position and broadcasts the change
func (p *ProgressServiceImpl) UpdatePlayerPosition(ctx context.Context, sessionID, playerID string) error {
	// Get player's current progress
	playerProgress, err := p.CalculatePlayerProgress(ctx, sessionID, playerID)
	if err != nil {
		return fmt.Errorf("failed to calculate player progress: %w", err)
	}
	
	// Broadcast position update to all players in the session
	if p.wsManager != nil {
		if err := p.wsManager.BroadcastPlayerPositionUpdate(
			sessionID, 
			playerID, 
			playerProgress.CurrentPosition, 
			playerProgress.TotalDoors,
		); err != nil {
			return fmt.Errorf("failed to broadcast position update: %w", err)
		}
	}
	
	return nil
}

// BroadcastProgressUpdates broadcasts complete progress updates to all players in a session
func (p *ProgressServiceImpl) BroadcastProgressUpdates(ctx context.Context, sessionID string) error {
	// Calculate session progress
	sessionProgress, err := p.CalculateSessionProgress(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to calculate session progress: %w", err)
	}
	
	// Broadcast to all players
	if p.wsManager != nil {
		if err := p.wsManager.BroadcastProgressUpdate(sessionID, *sessionProgress); err != nil {
			return fmt.Errorf("failed to broadcast progress update: %w", err)
		}
		
		// Also broadcast individual position updates for each player
		for _, player := range sessionProgress.Players {
			if err := p.wsManager.BroadcastPlayerPositionUpdate(
				sessionID,
				player.PlayerID,
				player.CurrentPosition,
				player.TotalDoors,
			); err != nil {
				fmt.Printf("Warning: failed to broadcast position update for player %s: %v\n", player.PlayerID, err)
			}
		}
	}
	
	return nil
}

// GetLeaderboard returns players sorted by their progress and performance
func (p *ProgressServiceImpl) GetLeaderboard(ctx context.Context, sessionID string) ([]PlayerProgress, error) {
	// Calculate session progress
	sessionProgress, err := p.CalculateSessionProgress(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate session progress: %w", err)
	}
	
	// Sort players by progress (position/totalDoors) and then by average score
	players := sessionProgress.Players
	
	// Simple bubble sort for leaderboard (can be optimized with sort.Slice if needed)
	for i := 0; i < len(players)-1; i++ {
		for j := 0; j < len(players)-i-1; j++ {
			// Calculate progress percentages
			progressJ := 0.0
			if players[j].TotalDoors > 0 {
				progressJ = float64(players[j].CurrentPosition) / float64(players[j].TotalDoors)
			}
			
			progressNext := 0.0
			if players[j+1].TotalDoors > 0 {
				progressNext = float64(players[j+1].CurrentPosition) / float64(players[j+1].TotalDoors)
			}
			
			// Sort by progress first, then by average score
			shouldSwap := false
			if progressNext > progressJ {
				shouldSwap = true
			} else if progressNext == progressJ && players[j+1].AverageScore > players[j].AverageScore {
				shouldSwap = true
			}
			
			if shouldSwap {
				players[j], players[j+1] = players[j+1], players[j]
			}
		}
	}
	
	return players, nil
}

// TrackPlayerResponse tracks a player's response and updates their progress in real-time
func (p *ProgressServiceImpl) TrackPlayerResponse(ctx context.Context, sessionID, playerID string, score int) error {
	// Update player position based on score
	if err := p.UpdatePlayerPosition(ctx, sessionID, playerID); err != nil {
		return fmt.Errorf("failed to update player position: %w", err)
	}
	
	// Get updated player progress
	playerProgress, err := p.CalculatePlayerProgress(ctx, sessionID, playerID)
	if err != nil {
		return fmt.Errorf("failed to calculate updated player progress: %w", err)
	}
	
	// Broadcast individual player progress update
	if p.wsManager != nil {
		event := WebSocketEvent{
			Type:      "player-progress-update",
			SessionID: sessionID,
			PlayerID:  playerID,
			Data: map[string]interface{}{
				"playerId":         playerID,
				"username":         playerProgress.Username,
				"currentPosition":  playerProgress.CurrentPosition,
				"totalDoors":       playerProgress.TotalDoors,
				"progressPercent":  float64(playerProgress.CurrentPosition) / float64(playerProgress.TotalDoors) * 100,
				"totalScore":       playerProgress.TotalScore,
				"averageScore":     playerProgress.AverageScore,
				"doorsCompleted":   playerProgress.DoorsCompleted,
				"newScore":         score,
			},
			Timestamp: time.Now(),
		}
		
		if err := p.wsManager.BroadcastToSession(sessionID, event); err != nil {
			return fmt.Errorf("failed to broadcast player progress update: %w", err)
		}
	}
	
	return nil
}

// BroadcastRealTimeScoreUpdate broadcasts immediate score updates when a player submits a response
func (p *ProgressServiceImpl) BroadcastRealTimeScoreUpdate(ctx context.Context, sessionID, playerID string, newScore, totalScore int) error {
	if p.wsManager == nil {
		return fmt.Errorf("websocket manager not available")
	}
	
	// Get player info for username
	session, err := p.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	var username string
	for _, player := range session.Players {
		if player.PlayerID == playerID {
			username = player.Username
			break
		}
	}
	
	// Broadcast score update event
	event := WebSocketEvent{
		Type:      "real-time-score-update",
		SessionID: sessionID,
		PlayerID:  playerID,
		Data: map[string]interface{}{
			"playerId":   playerID,
			"username":   username,
			"newScore":   newScore,
			"totalScore": totalScore,
			"message":    fmt.Sprintf("%s scored %d points!", username, newScore),
		},
		Timestamp: time.Now(),
	}
	
	return p.wsManager.BroadcastToSession(sessionID, event)
}

// GetRealTimeSessionStatus provides real-time session status with enhanced progress tracking
func (p *ProgressServiceImpl) GetRealTimeSessionStatus(ctx context.Context, sessionID string) (*SessionProgress, error) {
	// Get base session progress
	sessionProgress, err := p.CalculateSessionProgress(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate session progress: %w", err)
	}
	
	// Add additional real-time metrics
	for i, player := range sessionProgress.Players {
		// Check if player is currently responding (has active WebSocket connection)
		activeConnections := p.wsManager.GetActiveConnections(sessionID)
		isConnected := false
		for _, conn := range activeConnections {
			if conn.PlayerID == player.PlayerID {
				isConnected = true
				break
			}
		}
		sessionProgress.Players[i].IsActive = isConnected
	}
	
	return sessionProgress, nil
}

// GetFinalRankings calculates and returns the final rankings for a completed game session
func (p *ProgressServiceImpl) GetFinalRankings(ctx context.Context, sessionID string) ([]models.PlayerRanking, error) {
	// Get the game session
	session, err := p.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return nil, fmt.Errorf("session not found")
	}
	
	var rankings []models.PlayerRanking
	
	// Calculate rankings for each player
	for _, player := range session.Players {
		// Get player path for completion information
		playerPath, err := p.playerPathRepo.GetPlayerPath(ctx, player.PlayerID)
		if err != nil {
			// Use default values if path not found
			playerPath = &models.PlayerPath{
				PlayerID:        player.PlayerID,
				CurrentPosition: len(player.Responses),
				TotalDoors:      10, // Default
			}
		}
		
		// Calculate completion rate
		completionRate := 0.0
		if playerPath.TotalDoors > 0 {
			completionRate = float64(playerPath.CurrentPosition) / float64(playerPath.TotalDoors) * 100
		}
		
		// Calculate average score
		averageScore := 0.0
		if len(player.Responses) > 0 {
			totalScore := 0
			for _, response := range player.Responses {
				totalScore += response.AIScore
			}
			averageScore = float64(totalScore) / float64(len(player.Responses))
		}
		
		// Calculate completion time (if completed)
		var completionTime *time.Duration
		isWinner := playerPath.CurrentPosition >= playerPath.TotalDoors
		if isWinner && len(player.Responses) > 0 && session.StartedAt != nil {
			lastResponseTime := player.Responses[len(player.Responses)-1].SubmittedAt
			duration := lastResponseTime.Sub(*session.StartedAt)
			completionTime = &duration
		}
		
		ranking := models.PlayerRanking{
			PlayerID:       player.PlayerID,
			Username:       player.Username,
			CompletionTime: completionTime,
			TotalScore:     player.TotalScore,
			AverageScore:   averageScore,
			DoorsCompleted: len(player.Responses),
			TotalDoors:     playerPath.TotalDoors,
			CompletionRate: completionRate,
			IsWinner:       isWinner,
		}
		
		rankings = append(rankings, ranking)
	}
	
	// Sort rankings by completion status, then by completion time, then by score
	for i := 0; i < len(rankings)-1; i++ {
		for j := 0; j < len(rankings)-i-1; j++ {
			shouldSwap := false
			
			// Winners first
			if rankings[j+1].IsWinner && !rankings[j].IsWinner {
				shouldSwap = true
			} else if rankings[j].IsWinner == rankings[j+1].IsWinner {
				// Both winners or both non-winners
				if rankings[j].IsWinner {
					// Both are winners - sort by completion time
					if rankings[j+1].CompletionTime != nil && rankings[j].CompletionTime != nil {
						if *rankings[j+1].CompletionTime < *rankings[j].CompletionTime {
							shouldSwap = true
						}
					} else if rankings[j+1].CompletionTime != nil && rankings[j].CompletionTime == nil {
						shouldSwap = true
					}
				} else {
					// Both non-winners - sort by completion rate, then by average score
					if rankings[j+1].CompletionRate > rankings[j].CompletionRate {
						shouldSwap = true
					} else if rankings[j+1].CompletionRate == rankings[j].CompletionRate {
						if rankings[j+1].AverageScore > rankings[j].AverageScore {
							shouldSwap = true
						}
					}
				}
			}
			
			if shouldSwap {
				rankings[j], rankings[j+1] = rankings[j+1], rankings[j]
			}
		}
	}
	
	// Assign ranks
	for i := range rankings {
		rankings[i].Rank = i + 1
	}
	
	return rankings, nil
}

// GetPerformanceStatistics calculates and returns detailed performance statistics for all players
func (p *ProgressServiceImpl) GetPerformanceStatistics(ctx context.Context, sessionID string) ([]models.PlayerPerformanceStats, error) {
	// Get the game session
	session, err := p.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return nil, fmt.Errorf("session not found")
	}
	
	var stats []models.PlayerPerformanceStats
	
	for _, player := range session.Players {
		// Get player path for completion information
		playerPath, err := p.playerPathRepo.GetPlayerPath(ctx, player.PlayerID)
		if err != nil {
			playerPath = &models.PlayerPath{
				PlayerID:        player.PlayerID,
				CurrentPosition: len(player.Responses),
				TotalDoors:      10, // Default
			}
		}
		
		// Initialize statistics
		playerStats := models.PlayerPerformanceStats{
			PlayerID:       player.PlayerID,
			Username:       player.Username,
			TotalScore:     player.TotalScore,
			DoorsCompleted: len(player.Responses),
			TotalDoors:     playerPath.TotalDoors,
		}
		
		// Calculate completion rate
		if playerPath.TotalDoors > 0 {
			playerStats.CompletionRate = float64(playerPath.CurrentPosition) / float64(playerPath.TotalDoors) * 100
		}
		
		// Calculate completion time if player finished
		if playerPath.CurrentPosition >= playerPath.TotalDoors && len(player.Responses) > 0 && session.StartedAt != nil {
			lastResponseTime := player.Responses[len(player.Responses)-1].SubmittedAt
			duration := lastResponseTime.Sub(*session.StartedAt)
			playerStats.CompletionTime = &duration
		}
		
		// Calculate path efficiency (lower total doors = better efficiency)
		if playerPath.TotalDoors > 0 {
			// Efficiency is inverse of total doors, normalized to 0-100 scale
			// Assume 5 doors is perfect (100%), 15 doors is poor (33%)
			minDoors := 5.0
			maxDoors := 15.0
			efficiency := (maxDoors - float64(playerPath.TotalDoors)) / (maxDoors - minDoors) * 100
			if efficiency < 0 {
				efficiency = 0
			} else if efficiency > 100 {
				efficiency = 100
			}
			playerStats.PathEfficiency = efficiency
		}
		
		// Calculate response-based statistics
		if len(player.Responses) > 0 {
			totalScore := 0
			totalCreativity := 0
			totalFeasibility := 0
			totalHumor := 0
			totalOriginality := 0
			totalResponseTime := time.Duration(0)
			
			highestScore := player.Responses[0].AIScore
			lowestScore := player.Responses[0].AIScore
			
			var firstResponseTime *time.Time
			if session.StartedAt != nil {
				firstResponseTime = session.StartedAt
			} else {
				firstResponseTime = &player.Responses[0].SubmittedAt
			}
			
			for i, response := range player.Responses {
				totalScore += response.AIScore
				totalCreativity += response.ScoringMetrics.Creativity
				totalFeasibility += response.ScoringMetrics.Feasibility
				totalHumor += response.ScoringMetrics.Humor
				totalOriginality += response.ScoringMetrics.Originality
				
				if response.AIScore > highestScore {
					highestScore = response.AIScore
				}
				if response.AIScore < lowestScore {
					lowestScore = response.AIScore
				}
				
				// Calculate response time (time between doors or from game start)
				var responseStartTime time.Time
				if i == 0 {
					responseStartTime = *firstResponseTime
				} else {
					responseStartTime = player.Responses[i-1].SubmittedAt
				}
				responseTime := response.SubmittedAt.Sub(responseStartTime)
				totalResponseTime += responseTime
			}
			
			responseCount := len(player.Responses)
			playerStats.AverageScore = float64(totalScore) / float64(responseCount)
			playerStats.HighestScore = highestScore
			playerStats.LowestScore = lowestScore
			playerStats.AverageResponseTime = totalResponseTime / time.Duration(responseCount)
			playerStats.CreativityAverage = float64(totalCreativity) / float64(responseCount)
			playerStats.FeasibilityAverage = float64(totalFeasibility) / float64(responseCount)
			playerStats.HumorAverage = float64(totalHumor) / float64(responseCount)
			playerStats.OriginalityAverage = float64(totalOriginality) / float64(responseCount)
		}
		
		stats = append(stats, playerStats)
	}
	
	return stats, nil
}

// BroadcastGameCompletion broadcasts comprehensive game completion information
func (p *ProgressServiceImpl) BroadcastGameCompletion(ctx context.Context, sessionID, winnerID string, rankings []models.PlayerRanking, stats []models.PlayerPerformanceStats) error {
	if p.wsManager == nil {
		return fmt.Errorf("websocket manager not available")
	}
	
	// Broadcast final rankings
	if err := p.wsManager.BroadcastFinalRankings(sessionID, rankings); err != nil {
		return fmt.Errorf("failed to broadcast final rankings: %w", err)
	}
	
	// Broadcast performance statistics
	if err := p.wsManager.BroadcastPerformanceStatistics(sessionID, stats); err != nil {
		return fmt.Errorf("failed to broadcast performance statistics: %w", err)
	}
	
	// Broadcast final leaderboard
	leaderboard, err := p.GetLeaderboard(ctx, sessionID)
	if err == nil {
		if err := p.wsManager.BroadcastLeaderboardUpdate(sessionID, leaderboard); err != nil {
			fmt.Printf("Warning: failed to broadcast final leaderboard: %v\n", err)
		}
	}
	
	return nil
}