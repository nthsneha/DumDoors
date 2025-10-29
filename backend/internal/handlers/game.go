package handlers

import (
	"dumdoors-backend/internal/models"
	"dumdoors-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

// GameHandler handles game-related HTTP requests
type GameHandler struct {
	gameService        services.GameService
	progressService    services.ProgressService
	leaderboardService services.LeaderboardService
}

// NewGameHandler creates a new game handler
func NewGameHandler(gameService services.GameService, progressService services.ProgressService, leaderboardService services.LeaderboardService) *GameHandler {
	return &GameHandler{
		gameService:        gameService,
		progressService:    progressService,
		leaderboardService: leaderboardService,
	}
}

// CreateSessionRequest represents the request body for creating a session
type CreateSessionRequest struct {
	Mode     string  `json:"mode" validate:"required,oneof=multiplayer single-player"`
	Theme    *string `json:"theme,omitempty"`
	PlayerID string  `json:"playerId" validate:"required"`
	Username string  `json:"username" validate:"required"`
}

// JoinSessionRequest represents the request body for joining a session
type JoinSessionRequest struct {
	PlayerID string `json:"playerId" validate:"required"`
	Username string `json:"username" validate:"required"`
}

// StartGameRequest represents the request body for starting a game
type StartGameRequest struct {
	SessionID string `json:"sessionId" validate:"required"`
}

// GetAPIInfo returns basic API information
func (h *GameHandler) GetAPIInfo(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"message": "DumDoors Game API",
		"version": "1.0.0",
		"status":  "ready",
	})
}

// CreateSession creates a new game session
func (h *GameHandler) CreateSession(c *fiber.Ctx) error {
	var req CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}
	
	// Validate mode
	var mode models.GameMode
	switch req.Mode {
	case "multiplayer":
		mode = models.GameModeMultiplayer
	case "single-player":
		mode = models.GameModeSinglePlayer
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid game mode",
			"message": "Mode must be 'multiplayer' or 'single-player'",
		})
	}
	
	// Create session
	session, err := h.gameService.CreateSession(c.Context(), mode, req.PlayerID, req.Username, req.Theme)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to create session",
			"message": err.Error(),
		})
	}
	
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"session": session,
	})
}

// JoinSession allows a player to join an existing session
func (h *GameHandler) JoinSession(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	var req JoinSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}
	
	// Join session
	session, err := h.gameService.JoinSession(c.Context(), sessionID, req.PlayerID, req.Username)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Failed to join session",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"session": session,
	})
}

// GetSessionStatus retrieves the current status of a game session
func (h *GameHandler) GetSessionStatus(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	session, err := h.gameService.GetSessionStatus(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "Session not found",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"session": session,
	})
}

// StartGame starts a game session
func (h *GameHandler) StartGame(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	err := h.gameService.StartGame(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Failed to start game",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Game started successfully",
	})
}

// StartGameWithDoor starts a game session and presents the first door
func (h *GameHandler) StartGameWithDoor(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	err := h.gameService.StartGameWithFirstDoor(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Failed to start game with door",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Game started and first door presented",
	})
}

// SubmitResponseRequest represents the request body for submitting a response
type SubmitResponseRequest struct {
	SessionID string `json:"sessionId" validate:"required"`
	PlayerID  string `json:"playerId" validate:"required"`
	Response  string `json:"response" validate:"required,max=500"`
}

// SubmitResponse handles player response submission
func (h *GameHandler) SubmitResponse(c *fiber.Ctx) error {
	var req SubmitResponseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}
	
	// Validate response length (500 character limit as per requirements)
	if len(req.Response) > 500 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Response too long",
			"message": "Response must be 500 characters or less",
		})
	}
	
	if len(req.Response) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Response is required",
			"message": "Response cannot be empty",
		})
	}
	
	// Submit the response
	err := h.gameService.SubmitResponse(c.Context(), req.SessionID, req.PlayerID, req.Response)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Failed to submit response",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Response submitted successfully",
	})
}

// GetNextDoor retrieves the next door for a specific player
func (h *GameHandler) GetNextDoor(c *fiber.Ctx) error {
	playerID := c.Query("playerId")
	if playerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Player ID is required",
			"message": "Player ID must be provided as a query parameter",
		})
	}
	
	// Get current score from query params (default to 50 if not provided)
	currentScore := 50
	if scoreStr := c.Query("currentScore"); scoreStr != "" {
		if score := c.QueryInt("currentScore", 50); score != 50 {
			currentScore = score
		}
	}
	
	door, err := h.gameService.GetNextDoor(playerID, currentScore)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get next door",
			"message": err.Error(),
		})
	}
	
	if door == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "No door available",
			"message": "No next door found for player",
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"door":    door,
	})
}

// GetSessionProgress retrieves the current progress for all players in a session
func (h *GameHandler) GetSessionProgress(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	if h.progressService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Progress service unavailable",
			"message": "Progress tracking service is not available",
		})
	}
	
	progress, err := h.progressService.CalculateSessionProgress(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get session progress",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success":  true,
		"progress": progress,
	})
}

// GetPlayerProgress retrieves the current progress for a specific player
func (h *GameHandler) GetPlayerProgress(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	playerID := c.Params("playerId")
	
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	if playerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Player ID is required",
			"message": "Player ID must be provided in the URL path",
		})
	}
	
	if h.progressService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Progress service unavailable",
			"message": "Progress tracking service is not available",
		})
	}
	
	progress, err := h.progressService.CalculatePlayerProgress(c.Context(), sessionID, playerID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get player progress",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success":  true,
		"progress": progress,
	})
}

// GetLeaderboard retrieves the leaderboard for a session
func (h *GameHandler) GetLeaderboard(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	if h.progressService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Progress service unavailable",
			"message": "Progress tracking service is not available",
		})
	}
	
	leaderboard, err := h.progressService.GetLeaderboard(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get leaderboard",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success":    true,
		"leaderboard": leaderboard,
	})
}

// GetRealTimeProgress retrieves real-time progress with enhanced tracking
func (h *GameHandler) GetRealTimeProgress(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	if h.progressService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Progress service unavailable",
			"message": "Progress tracking service is not available",
		})
	}
	
	progress, err := h.progressService.GetRealTimeSessionStatus(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get real-time progress",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success":  true,
		"progress": progress,
		"realTime": true,
	})
}

// BroadcastProgressUpdate manually triggers a progress update broadcast (for testing/admin)
func (h *GameHandler) BroadcastProgressUpdate(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	if h.progressService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Progress service unavailable",
			"message": "Progress tracking service is not available",
		})
	}
	
	err := h.progressService.BroadcastProgressUpdates(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to broadcast progress update",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Progress update broadcasted successfully",
	})
}

// Global Leaderboard Endpoints

// GetGlobalLeaderboard retrieves the global leaderboard with all categories
func (h *GameHandler) GetGlobalLeaderboard(c *fiber.Ctx) error {
	if h.leaderboardService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Leaderboard service unavailable",
			"message": "Leaderboard service is not available",
		})
	}
	
	// Parse query parameters for filtering
	filter := models.LeaderboardFilter{
		Limit: c.QueryInt("limit", 10),
	}
	
	if gameMode := c.Query("gameMode"); gameMode != "" {
		mode := models.GameMode(gameMode)
		filter.GameMode = &mode
	}
	
	if theme := c.Query("theme"); theme != "" {
		filter.Theme = &theme
	}
	
	if timeRange := c.Query("timeRange"); timeRange != "" {
		filter.TimeRange = &timeRange
	}
	
	leaderboard, err := h.leaderboardService.GetGlobalLeaderboard(c.Context(), filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get global leaderboard",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success":     true,
		"leaderboard": leaderboard,
		"filter":      filter,
	})
}

// GetLeaderboardStats retrieves aggregated leaderboard statistics
func (h *GameHandler) GetLeaderboardStats(c *fiber.Ctx) error {
	if h.leaderboardService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Leaderboard service unavailable",
			"message": "Leaderboard service is not available",
		})
	}
	
	stats, err := h.leaderboardService.GetLeaderboardStats(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get leaderboard stats",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"stats":   stats,
	})
}

// GetFastestCompletions retrieves the fastest completion times leaderboard
func (h *GameHandler) GetFastestCompletions(c *fiber.Ctx) error {
	if h.leaderboardService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Leaderboard service unavailable",
			"message": "Leaderboard service is not available",
		})
	}
	
	// Parse query parameters for filtering
	filter := models.LeaderboardFilter{
		Limit: c.QueryInt("limit", 10),
	}
	
	if gameMode := c.Query("gameMode"); gameMode != "" {
		mode := models.GameMode(gameMode)
		filter.GameMode = &mode
	}
	
	if theme := c.Query("theme"); theme != "" {
		filter.Theme = &theme
	}
	
	if timeRange := c.Query("timeRange"); timeRange != "" {
		filter.TimeRange = &timeRange
	}
	
	entries, err := h.leaderboardService.GetFastestCompletions(c.Context(), filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get fastest completions",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"entries": entries,
		"filter":  filter,
	})
}

// GetHighestAverageScores retrieves the highest average scores leaderboard
func (h *GameHandler) GetHighestAverageScores(c *fiber.Ctx) error {
	if h.leaderboardService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Leaderboard service unavailable",
			"message": "Leaderboard service is not available",
		})
	}
	
	// Parse query parameters for filtering
	filter := models.LeaderboardFilter{
		Limit: c.QueryInt("limit", 10),
	}
	
	if gameMode := c.Query("gameMode"); gameMode != "" {
		mode := models.GameMode(gameMode)
		filter.GameMode = &mode
	}
	
	if theme := c.Query("theme"); theme != "" {
		filter.Theme = &theme
	}
	
	if timeRange := c.Query("timeRange"); timeRange != "" {
		filter.TimeRange = &timeRange
	}
	
	entries, err := h.leaderboardService.GetHighestAverageScores(c.Context(), filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get highest average scores",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"entries": entries,
		"filter":  filter,
	})
}

// GetPlayerRank retrieves a player's rank in a specific leaderboard category
func (h *GameHandler) GetPlayerRank(c *fiber.Ctx) error {
	playerID := c.Params("playerId")
	category := c.Params("category")
	
	if playerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Player ID is required",
			"message": "Player ID must be provided in the URL path",
		})
	}
	
	if category == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Category is required",
			"message": "Category must be provided in the URL path",
		})
	}
	
	if h.leaderboardService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Leaderboard service unavailable",
			"message": "Leaderboard service is not available",
		})
	}
	
	rank, err := h.leaderboardService.GetPlayerRank(c.Context(), playerID, category)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get player rank",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success":  true,
		"playerId": playerID,
		"category": category,
		"rank":     rank,
	})
}