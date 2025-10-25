package services

import (
	"context"
	"dumdoors-backend/internal/models"
	"dumdoors-backend/internal/repositories"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// GameService interface defines the contract for game operations
type GameService interface {
	CreateSession(ctx context.Context, mode models.GameMode, creatorID, username string, theme *string) (*models.GameSession, error)
	JoinSession(ctx context.Context, sessionID, playerID, username string) (*models.GameSession, error)
	StartGame(ctx context.Context, sessionID string) error
	StartGameWithFirstDoor(ctx context.Context, sessionID string) error
	PresentDoorToSession(ctx context.Context, sessionID string, door *models.Door) error
	SubmitResponse(ctx context.Context, sessionID, playerID, response string) error
	GetNextDoor(playerID string, currentScore int) (*models.Door, error)
	CalculatePlayerPath(playerID string, scores []int) error
	GetSessionStatus(ctx context.Context, sessionID string) (*models.GameSession, error)
	ValidatePlayerJoin(ctx context.Context, sessionID, playerID string) error
}

// GameServiceImpl implements the GameService interface
type GameServiceImpl struct {
	gameSessionRepo repositories.GameSessionRepository
	doorRepo        repositories.DoorRepository
	playerPathRepo  repositories.PlayerPathRepository
	wsManager       WebSocketManager
	aiClient        AIClient
}

// NewGameService creates a new game service instance
func NewGameService(gameSessionRepo repositories.GameSessionRepository, doorRepo repositories.DoorRepository, playerPathRepo repositories.PlayerPathRepository, wsManager WebSocketManager, aiClient AIClient) GameService {
	return &GameServiceImpl{
		gameSessionRepo: gameSessionRepo,
		doorRepo:        doorRepo,
		playerPathRepo:  playerPathRepo,
		wsManager:       wsManager,
		aiClient:        aiClient,
	}
}

// CreateSession creates a new game session
func (s *GameServiceImpl) CreateSession(ctx context.Context, mode models.GameMode, creatorID, username string, theme *string) (*models.GameSession, error) {
	// Generate unique session ID
	sessionID := uuid.New().String()
	
	// Create the creator as the first player
	creator := models.PlayerInfo{
		PlayerID:        creatorID,
		Username:        username,
		RedditUserID:    creatorID, // Assuming playerID is the Reddit user ID
		JoinedAt:        time.Now(),
		CurrentPosition: 0,
		TotalScore:      0,
		Responses:       []models.PlayerResponse{},
		IsActive:        true,
	}
	
	// Create the game session
	session := &models.GameSession{
		SessionID:   sessionID,
		Mode:        mode,
		Theme:       theme,
		Players:     []models.PlayerInfo{creator},
		Status:      models.GameStatusWaiting,
		CurrentDoor: nil,
		CreatedAt:   time.Now(),
	}
	
	// Save to database
	if err := s.gameSessionRepo.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to create game session: %w", err)
	}
	
	// Create player node in Neo4j for path tracking
	if err := s.playerPathRepo.CreatePlayer(ctx, creatorID, username); err != nil {
		// Log error but don't fail session creation
		fmt.Printf("Warning: failed to create player in Neo4j: %v\n", err)
	}
	
	return session, nil
}

// JoinSession allows a player to join an existing session
func (s *GameServiceImpl) JoinSession(ctx context.Context, sessionID, playerID, username string) (*models.GameSession, error) {
	// Validate that the player can join
	if err := s.ValidatePlayerJoin(ctx, sessionID, playerID); err != nil {
		return nil, err
	}
	
	// Get the current session
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return nil, fmt.Errorf("session not found")
	}
	
	// Create new player info
	newPlayer := models.PlayerInfo{
		PlayerID:        playerID,
		Username:        username,
		RedditUserID:    playerID,
		JoinedAt:        time.Now(),
		CurrentPosition: 0,
		TotalScore:      0,
		Responses:       []models.PlayerResponse{},
		IsActive:        true,
	}
	
	// Add player to session
	if err := s.gameSessionRepo.AddPlayerToSession(ctx, sessionID, newPlayer); err != nil {
		return nil, fmt.Errorf("failed to add player to session: %w", err)
	}
	
	// Create player node in Neo4j for path tracking
	if err := s.playerPathRepo.CreatePlayer(ctx, playerID, username); err != nil {
		// Log error but don't fail join operation
		fmt.Printf("Warning: failed to create player in Neo4j: %v\n", err)
	}
	
	// Get updated session
	updatedSession, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated session: %w", err)
	}
	
	// Notify other players via WebSocket about the new player joining
	if s.wsManager != nil {
		event := WebSocketEvent{
			Type:      "player-joined",
			SessionID: sessionID,
			PlayerID:  playerID,
			Data: map[string]interface{}{
				"playerId": playerID,
				"username": username,
				"message":  fmt.Sprintf("%s joined the game", username),
				"session":  updatedSession,
			},
			Timestamp: time.Now(),
		}
		
		// Broadcast to session (this will be handled gracefully if no WebSocket connections exist yet)
		go func() {
			if err := s.wsManager.BroadcastToSession(sessionID, event); err != nil {
				fmt.Printf("Warning: failed to broadcast player join event: %v\n", err)
			}
		}()
	}
	
	return updatedSession, nil
}

// ValidatePlayerJoin validates that a player can join a session
func (s *GameServiceImpl) ValidatePlayerJoin(ctx context.Context, sessionID, playerID string) error {
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return fmt.Errorf("session not found")
	}
	
	// Check if session is still accepting players
	if session.Status != models.GameStatusWaiting {
		return fmt.Errorf("session is not accepting new players")
	}
	
	// Check if player is already in the session
	for _, player := range session.Players {
		if player.PlayerID == playerID {
			return fmt.Errorf("player already in session")
		}
	}
	
	// Check player limit for multiplayer mode (max 8 players)
	if session.Mode == models.GameModeMultiplayer && len(session.Players) >= 8 {
		return fmt.Errorf("session is full (maximum 8 players)")
	}
	
	// Single player mode should only have 1 player
	if session.Mode == models.GameModeSinglePlayer && len(session.Players) >= 1 {
		return fmt.Errorf("single player session already has a player")
	}
	
	return nil
}

// GetSessionStatus retrieves the current status of a game session
func (s *GameServiceImpl) GetSessionStatus(ctx context.Context, sessionID string) (*models.GameSession, error) {
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session status: %w", err)
	}
	
	if session == nil {
		return nil, fmt.Errorf("session not found")
	}
	
	return session, nil
}

// StartGame starts a game session
func (s *GameServiceImpl) StartGame(ctx context.Context, sessionID string) error {
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return fmt.Errorf("session not found")
	}
	
	// Validate session can be started
	if session.Status != models.GameStatusWaiting {
		return fmt.Errorf("session cannot be started (current status: %s)", session.Status)
	}
	
	// Check minimum players for multiplayer (at least 2)
	if session.Mode == models.GameModeMultiplayer && len(session.Players) < 2 {
		return fmt.Errorf("multiplayer session requires at least 2 players")
	}
	
	// Update session status
	now := time.Now()
	session.Status = models.GameStatusActive
	session.StartedAt = &now
	
	// Save updated session
	if err := s.gameSessionRepo.Update(ctx, session); err != nil {
		return fmt.Errorf("failed to start game session: %w", err)
	}
	
	// Notify all players via WebSocket that the game has started
	if s.wsManager != nil {
		event := WebSocketEvent{
			Type:      "game-started",
			SessionID: sessionID,
			Data: map[string]interface{}{
				"message":   "Game has started!",
				"session":   session,
				"startedAt": session.StartedAt,
			},
			Timestamp: time.Now(),
		}
		
		// Broadcast to all players in the session
		go func() {
			if err := s.wsManager.BroadcastToSession(sessionID, event); err != nil {
				fmt.Printf("Warning: failed to broadcast game start event: %v\n", err)
			}
		}()
	}
	
	return nil
}

// GetNextDoor retrieves the next door for a player based on their current score and position
func (s *GameServiceImpl) GetNextDoor(playerID string, currentScore int) (*models.Door, error) {
	ctx := context.Background()
	
	// Get player's current path information from Neo4j
	playerPath, err := s.playerPathRepo.GetPlayerPath(ctx, playerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get player path: %w", err)
	}
	
	// Determine theme and difficulty based on player's path and score
	theme := "general"
	difficulty := 1
	
	if playerPath != nil {
		theme = playerPath.Theme
		// Adjust difficulty based on player performance
		if currentScore > 70 {
			difficulty = max(1, playerPath.CurrentDifficulty-1) // Easier path for good performance
		} else if currentScore < 30 {
			difficulty = min(3, playerPath.CurrentDifficulty+1) // Harder path for poor performance
		} else {
			difficulty = playerPath.CurrentDifficulty // Maintain current difficulty
		}
	}
	
	// Try to get an existing door from the database first
	doors, err := s.doorRepo.GetByTheme(ctx, theme)
	if err == nil && len(doors) > 0 {
		// Find a door with appropriate difficulty
		for _, door := range doors {
			if door.Difficulty == difficulty {
				return door, nil
			}
		}
		// If no exact difficulty match, return the first door of the theme
		return doors[0], nil
	}
	
	// If no existing doors, generate a new one using AI service
	// For now, we'll create a simple door since AI service integration is basic
	door, err := s.generateDoor(ctx, theme, difficulty)
	if err != nil {
		return nil, fmt.Errorf("failed to generate door: %w", err)
	}
	
	// Save the generated door to database for future use
	if err := s.doorRepo.Create(ctx, door); err != nil {
		// Log error but don't fail - we can still return the door
		fmt.Printf("Warning: failed to save generated door: %v\n", err)
	}
	
	return door, nil
}

// PresentDoorToSession presents a door to all players in a session
func (s *GameServiceImpl) PresentDoorToSession(ctx context.Context, sessionID string, door *models.Door) error {
	// Get the session to validate it exists and is active
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return fmt.Errorf("session not found")
	}
	
	if session.Status != models.GameStatusActive {
		return fmt.Errorf("session is not active")
	}
	
	// Update session with current door
	session.CurrentDoor = door
	if err := s.gameSessionRepo.Update(ctx, session); err != nil {
		return fmt.Errorf("failed to update session with current door: %w", err)
	}
	
	// Broadcast door to all players via WebSocket
	if s.wsManager != nil {
		event := WebSocketEvent{
			Type:      "door-presented",
			SessionID: sessionID,
			Data: map[string]interface{}{
				"door":      door,
				"message":   "New door presented! You have 60 seconds to respond.",
				"timeLimit": 60, // 60 seconds as per requirements
			},
			Timestamp: time.Now(),
		}
		
		if err := s.wsManager.BroadcastToSession(sessionID, event); err != nil {
			return fmt.Errorf("failed to broadcast door to session: %w", err)
		}
		
		// Start timeout timer for this door (60 seconds as per requirements 2.5)
		go s.startResponseTimeout(sessionID, door.DoorID, 60*time.Second)
	}
	
	return nil
}

// StartGameWithFirstDoor starts a game and presents the first door
func (s *GameServiceImpl) StartGameWithFirstDoor(ctx context.Context, sessionID string) error {
	// Start the game first
	if err := s.StartGame(ctx, sessionID); err != nil {
		return err
	}
	
	// Get the session to access players
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session after starting: %w", err)
	}
	
	// For multiplayer, all players get the same door initially
	// For single player, generate based on theme if provided
	theme := "general"
	if session.Theme != nil {
		theme = *session.Theme
	}
	
	// Generate the first door
	door, err := s.generateDoor(ctx, theme, 1) // Start with difficulty 1
	if err != nil {
		return fmt.Errorf("failed to generate first door: %w", err)
	}
	
	// Present the door to all players in the session
	if err := s.PresentDoorToSession(ctx, sessionID, door); err != nil {
		return fmt.Errorf("failed to present first door: %w", err)
	}
	
	return nil
}

// generateDoor creates a new door using available methods
func (s *GameServiceImpl) generateDoor(ctx context.Context, theme string, difficulty int) (*models.Door, error) {
	// For now, create doors directly since AI service is basic
	// This will be enhanced when AI service endpoints are fully implemented
	
	doorID := fmt.Sprintf("door_%d_%s_%d", time.Now().Unix(), theme, difficulty)
	
	var content string
	switch theme {
	case "workplace":
		switch difficulty {
		case 1:
			content = "Your coworker keeps microwaving fish in the office kitchen. How do you address this delicate situation?"
		case 2:
			content = "You accidentally sent a message complaining about your boss to your boss. The message was just delivered. What's your strategy?"
		case 3:
			content = "You're in charge of organizing the office holiday party, but you have a budget of $12 and everyone has dietary restrictions. How do you pull this off?"
		}
	case "social":
		switch difficulty {
		case 1:
			content = "You're at a party where you don't know anyone except the host, who just disappeared. How do you survive the next hour?"
		case 2:
			content = "You accidentally called your friend by their ex's name during their wedding speech. Everyone heard it. How do you recover?"
		case 3:
			content = "You're stuck in a group chat with your ex, their new partner, and your current partner planning a mutual friend's surprise party. How do you navigate this?"
		}
	case "technology":
		switch difficulty {
		case 1:
			content = "Your phone's autocorrect has become sentient and is now changing your messages to be increasingly dramatic. How do you communicate normally?"
		case 2:
			content = "Every smart device in your home has formed an alliance against you. They're not malicious, just very disappointed. How do you win them back?"
		case 3:
			content = "You've been selected to negotiate a peace treaty between humans and AI, but the AI only communicates through memes. How do you proceed?"
		}
	default:
		switch difficulty {
		case 1:
			content = "You wake up and discover that everyone else in the world has disappeared, but they left detailed notes about what they expect you to accomplish while they're gone. What's your plan?"
		case 2:
			content = "You've been appointed as the Earth's ambassador to a visiting alien species, but they communicate entirely through interpretive dance. How do you establish diplomatic relations?"
		case 3:
			content = "Time moves backwards every Tuesday, but only for you. Everyone else experiences Tuesday normally. How do you use this to your advantage without going insane?"
		}
	}
	
	door := &models.Door{
		DoorID:                doorID,
		Content:               content,
		Theme:                 theme,
		Difficulty:            difficulty,
		ExpectedSolutionTypes: []string{"creative", "practical", "humorous"},
		CreatedAt:             time.Now(),
	}
	
	return door, nil
}

// SubmitResponse handles player response submission with validation, scoring, and state updates
func (s *GameServiceImpl) SubmitResponse(ctx context.Context, sessionID, playerID, response string) error {
	// Get the current session
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return fmt.Errorf("session not found")
	}
	
	// Validate session is active
	if session.Status != models.GameStatusActive {
		return fmt.Errorf("session is not active")
	}
	
	// Validate current door exists
	if session.CurrentDoor == nil {
		return fmt.Errorf("no active door in session")
	}
	
	// Find the player in the session
	var playerIndex = -1
	for i, player := range session.Players {
		if player.PlayerID == playerID {
			playerIndex = i
			break
		}
	}
	
	if playerIndex == -1 {
		return fmt.Errorf("player not found in session")
	}
	
	// Check if player has already responded to this door
	currentDoorID := session.CurrentDoor.DoorID
	for _, response := range session.Players[playerIndex].Responses {
		if response.DoorID == currentDoorID {
			return fmt.Errorf("player has already responded to this door")
		}
	}
	
	// Validate response length (500 character limit as per requirements 2.4)
	if len(response) > 500 {
		return fmt.Errorf("response exceeds 500 character limit")
	}
	
	if len(response) == 0 {
		return fmt.Errorf("response cannot be empty")
	}
	
	// Score the response using AI service
	scoringMetrics, err := s.aiClient.ScoreResponse(ctx, session.CurrentDoor, response)
	if err != nil {
		// If AI service fails, use fallback scoring
		fmt.Printf("Warning: AI scoring failed, using fallback: %v\n", err)
		scoringMetrics = &models.ScoringMetrics{
			Creativity:  50,
			Feasibility: 50,
			Humor:       50,
			Originality: 50,
		}
	}
	
	// Calculate total AI score (average of all metrics)
	totalScore := (scoringMetrics.Creativity + scoringMetrics.Feasibility + 
				  scoringMetrics.Humor + scoringMetrics.Originality) / 4
	
	// Create player response record
	playerResponse := models.PlayerResponse{
		ResponseID:     fmt.Sprintf("resp_%d_%s", time.Now().Unix(), playerID),
		DoorID:         currentDoorID,
		PlayerID:       playerID,
		Content:        response,
		AIScore:        totalScore,
		SubmittedAt:    time.Now(),
		ScoringMetrics: *scoringMetrics,
	}
	
	// Add response to player's record and update total score
	session.Players[playerIndex].Responses = append(session.Players[playerIndex].Responses, playerResponse)
	session.Players[playerIndex].TotalScore += totalScore
	
	// Update session in database
	if err := s.gameSessionRepo.Update(ctx, session); err != nil {
		return fmt.Errorf("failed to update session with response: %w", err)
	}
	
	// Update player path in Neo4j based on score
	if err := s.updatePlayerPath(ctx, playerID, totalScore, currentDoorID); err != nil {
		// Log error but don't fail the response submission
		fmt.Printf("Warning: failed to update player path: %v\n", err)
	}
	
	// Broadcast response submission to all players in session
	if s.wsManager != nil {
		event := WebSocketEvent{
			Type:      "response-submitted",
			SessionID: sessionID,
			PlayerID:  playerID,
			Data: map[string]interface{}{
				"playerId":    playerID,
				"score":       totalScore,
				"message":     fmt.Sprintf("Player %s submitted their response", session.Players[playerIndex].Username),
				"responseId":  playerResponse.ResponseID,
				"submittedAt": playerResponse.SubmittedAt,
			},
			Timestamp: time.Now(),
		}
		
		go func() {
			if err := s.wsManager.BroadcastToSession(sessionID, event); err != nil {
				fmt.Printf("Warning: failed to broadcast response submission: %v\n", err)
			}
		}()
	}
	
	// Check if all players have responded to current door
	allResponded := s.checkAllPlayersResponded(session, currentDoorID)
	if allResponded {
		// All players have responded, trigger next phase
		go func() {
			if err := s.processAllResponses(ctx, sessionID); err != nil {
				fmt.Printf("Error processing all responses: %v\n", err)
			}
		}()
	}
	
	return nil
}

// updatePlayerPath updates the player's path in Neo4j based on their score
func (s *GameServiceImpl) updatePlayerPath(ctx context.Context, playerID string, score int, doorID string) error {
	// Get current player path
	playerPath, err := s.playerPathRepo.GetPlayerPath(ctx, playerID)
	if err != nil {
		return fmt.Errorf("failed to get player path: %w", err)
	}
	
	// If no path exists, create one
	if playerPath == nil {
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
	
	// Add door to visited doors
	playerPath.DoorsVisited = append(playerPath.DoorsVisited, doorID)
	playerPath.CurrentPosition++
	
	// Adjust path based on score (requirements 3.4, 3.5)
	if score > 70 {
		// Good performance - shorter path
		if playerPath.TotalDoors > 5 {
			playerPath.TotalDoors--
		}
		// Reduce difficulty for next door
		if playerPath.CurrentDifficulty > 1 {
			playerPath.CurrentDifficulty--
		}
	} else if score < 30 {
		// Poor performance - longer path
		playerPath.TotalDoors++
		// Increase difficulty for next door
		if playerPath.CurrentDifficulty < 3 {
			playerPath.CurrentDifficulty++
		}
	}
	
	// Update path in Neo4j
	return s.playerPathRepo.UpdatePlayerPath(ctx, playerPath)
}

// checkAllPlayersResponded checks if all active players have responded to the current door
func (s *GameServiceImpl) checkAllPlayersResponded(session *models.GameSession, doorID string) bool {
	for _, player := range session.Players {
		if !player.IsActive {
			continue // Skip inactive players
		}
		
		// Check if this player has responded to the current door
		hasResponded := false
		for _, response := range player.Responses {
			if response.DoorID == doorID {
				hasResponded = true
				break
			}
		}
		
		if !hasResponded {
			return false
		}
	}
	
	return true
}

// processAllResponses handles the logic when all players have responded
func (s *GameServiceImpl) processAllResponses(ctx context.Context, sessionID string) error {
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	if session == nil {
		return fmt.Errorf("session not found")
	}
	
	// Broadcast scores update to all players
	if s.wsManager != nil {
		// Collect all player scores for this door
		doorScores := make(map[string]int)
		currentDoorID := session.CurrentDoor.DoorID
		
		for _, player := range session.Players {
			for _, response := range player.Responses {
				if response.DoorID == currentDoorID {
					doorScores[player.PlayerID] = response.AIScore
					break
				}
			}
		}
		
		event := WebSocketEvent{
			Type:      "scores-updated",
			SessionID: sessionID,
			Data: map[string]interface{}{
				"doorId":     currentDoorID,
				"scores":     doorScores,
				"message":    "All players have responded! Scores updated.",
				"session":    session,
			},
			Timestamp: time.Now(),
		}
		
		if err := s.wsManager.BroadcastToSession(sessionID, event); err != nil {
			fmt.Printf("Warning: failed to broadcast scores update: %v\n", err)
		}
	}
	
	// Check if any player has completed their path (won the game)
	for _, player := range session.Players {
		playerPath, err := s.playerPathRepo.GetPlayerPath(ctx, player.PlayerID)
		if err != nil {
			continue // Skip on error
		}
		
		if playerPath != nil && playerPath.CurrentPosition >= playerPath.TotalDoors {
			// Player has won!
			return s.handleGameCompletion(ctx, sessionID, player.PlayerID)
		}
	}
	
	// If no winner yet, present next door after a brief delay
	time.Sleep(3 * time.Second) // Give players time to see scores
	
	// For multiplayer, each player gets their own next door based on their path
	// For single player, just get the next door for the single player
	if session.Mode == models.GameModeMultiplayer {
		return s.presentNextDoorsToPlayers(ctx, sessionID)
	} else {
		// Single player - get next door for the single player
		if len(session.Players) > 0 {
			playerID := session.Players[0].PlayerID
			lastScore := 50 // Default score
			if len(session.Players[0].Responses) > 0 {
				lastScore = session.Players[0].Responses[len(session.Players[0].Responses)-1].AIScore
			}
			
			nextDoor, err := s.GetNextDoor(playerID, lastScore)
			if err != nil {
				return fmt.Errorf("failed to get next door for single player: %w", err)
			}
			
			return s.PresentDoorToSession(ctx, sessionID, nextDoor)
		}
	}
	
	return nil
}

// presentNextDoorsToPlayers presents appropriate next doors to each player in multiplayer
func (s *GameServiceImpl) presentNextDoorsToPlayers(ctx context.Context, sessionID string) error {
	// For now, present the same door to all players
	// This can be enhanced later to give different doors based on individual paths
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	// Get average score to determine next door difficulty
	totalScore := 0
	activePlayerCount := 0
	for _, player := range session.Players {
		if player.IsActive && len(player.Responses) > 0 {
			totalScore += player.Responses[len(player.Responses)-1].AIScore
			activePlayerCount++
		}
	}
	
	averageScore := 50 // Default
	if activePlayerCount > 0 {
		averageScore = totalScore / activePlayerCount
	}
	
	// Generate next door based on average performance
	theme := "general"
	if session.Theme != nil {
		theme = *session.Theme
	}
	
	nextDoor, err := s.generateDoor(ctx, theme, s.calculateDifficultyFromScore(averageScore))
	if err != nil {
		return fmt.Errorf("failed to generate next door: %w", err)
	}
	
	return s.PresentDoorToSession(ctx, sessionID, nextDoor)
}

// calculateDifficultyFromScore determines door difficulty based on player score
func (s *GameServiceImpl) calculateDifficultyFromScore(score int) int {
	if score > 70 {
		return 1 // Easier for good performance
	} else if score < 30 {
		return 3 // Harder for poor performance
	}
	return 2 // Medium difficulty
}

// handleGameCompletion handles when a player completes their path
func (s *GameServiceImpl) handleGameCompletion(ctx context.Context, sessionID, winnerPlayerID string) error {
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	
	// Mark session as completed
	now := time.Now()
	session.Status = models.GameStatusCompleted
	session.CompletedAt = &now
	
	if err := s.gameSessionRepo.Update(ctx, session); err != nil {
		return fmt.Errorf("failed to update session completion: %w", err)
	}
	
	// Find winner's username
	winnerUsername := "Unknown"
	for _, player := range session.Players {
		if player.PlayerID == winnerPlayerID {
			winnerUsername = player.Username
			break
		}
	}
	
	// Broadcast game completion to all players
	if s.wsManager != nil {
		event := WebSocketEvent{
			Type:      "game-completed",
			SessionID: sessionID,
			Data: map[string]interface{}{
				"winnerId":       winnerPlayerID,
				"winnerUsername": winnerUsername,
				"message":        fmt.Sprintf("%s has won the game!", winnerUsername),
				"session":        session,
				"completedAt":    session.CompletedAt,
			},
			Timestamp: time.Now(),
		}
		
		if err := s.wsManager.BroadcastToSession(sessionID, event); err != nil {
			fmt.Printf("Warning: failed to broadcast game completion: %v\n", err)
		}
	}
	
	return nil
}

// CalculatePlayerPath calculates the player's path based on scores (placeholder implementation)
func (s *GameServiceImpl) CalculatePlayerPath(playerID string, scores []int) error {
	// Implementation will be added in later tasks
	return nil
}

// startResponseTimeout starts a timeout timer for door responses
func (s *GameServiceImpl) startResponseTimeout(sessionID, doorID string, timeout time.Duration) {
	time.Sleep(timeout)
	
	ctx := context.Background()
	session, err := s.gameSessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		fmt.Printf("Error getting session for timeout: %v\n", err)
		return
	}
	
	if session == nil || session.Status != models.GameStatusActive {
		return // Session no longer active
	}
	
	// Check if this door is still the current door
	if session.CurrentDoor == nil || session.CurrentDoor.DoorID != doorID {
		return // Door has already changed
	}
	
	// Check if all players have already responded
	if s.checkAllPlayersResponded(session, doorID) {
		return // All players already responded
	}
	
	// Handle timeout - process responses from players who did respond
	fmt.Printf("Response timeout reached for door %s in session %s\n", doorID, sessionID)
	
	// Broadcast timeout event
	if s.wsManager != nil {
		event := WebSocketEvent{
			Type:      "response-timeout",
			SessionID: sessionID,
			Data: map[string]interface{}{
				"doorId":  doorID,
				"message": "Time's up! Processing responses from players who submitted.",
			},
			Timestamp: time.Now(),
		}
		
		if err := s.wsManager.BroadcastToSession(sessionID, event); err != nil {
			fmt.Printf("Warning: failed to broadcast timeout event: %v\n", err)
		}
	}
	
	// Process responses even if not all players responded
	go func() {
		if err := s.processAllResponses(ctx, sessionID); err != nil {
			fmt.Printf("Error processing responses after timeout: %v\n", err)
		}
	}()
}

// Helper functions
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}