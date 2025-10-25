package handlers

import (
	"context"
	"dumdoors-backend/internal/services"
	"log"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	wsManager   services.WebSocketManager
	gameService services.GameService
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(wsManager services.WebSocketManager, gameService services.GameService) *WebSocketHandler {
	return &WebSocketHandler{
		wsManager:   wsManager,
		gameService: gameService,
	}
}

// UpgradeConnection handles WebSocket upgrade requests
func (h *WebSocketHandler) UpgradeConnection(c *fiber.Ctx) error {
	// Check if the request is a WebSocket upgrade
	if websocket.IsWebSocketUpgrade(c) {
		return websocket.New(h.handleWebSocketConnection)(c)
	}
	
	return c.Status(fiber.StatusUpgradeRequired).JSON(fiber.Map{
		"error":   "WebSocket upgrade required",
		"message": "This endpoint requires a WebSocket connection",
	})
}

// handleWebSocketConnection handles individual WebSocket connections
func (h *WebSocketHandler) handleWebSocketConnection(c *websocket.Conn) {
	// Extract session ID and player ID from query parameters
	sessionID := c.Query("sessionId")
	playerID := c.Query("playerId")
	
	if sessionID == "" || playerID == "" {
		log.Printf("WebSocket connection rejected: missing sessionId or playerId")
		c.WriteMessage(websocket.TextMessage, []byte(`{"error": "sessionId and playerId are required"}`))
		c.Close()
		return
	}
	
	// Validate that the session exists and player is part of it
	ctx := context.Background()
	session, err := h.gameService.GetSessionStatus(ctx, sessionID)
	if err != nil {
		log.Printf("WebSocket connection rejected: invalid session %s", sessionID)
		c.WriteMessage(websocket.TextMessage, []byte(`{"error": "Invalid session"}`))
		c.Close()
		return
	}
	
	// Check if player is in the session
	playerFound := false
	for _, player := range session.Players {
		if player.PlayerID == playerID {
			playerFound = true
			break
		}
	}
	
	if !playerFound {
		log.Printf("WebSocket connection rejected: player %s not in session %s", playerID, sessionID)
		c.WriteMessage(websocket.TextMessage, []byte(`{"error": "Player not in session"}`))
		c.Close()
		return
	}
	
	log.Printf("WebSocket connection established for player %s in session %s", playerID, sessionID)
	
	// Send welcome message
	welcomeEvent := services.WebSocketEvent{
		Type:      "connection-established",
		SessionID: sessionID,
		PlayerID:  playerID,
		Data: map[string]interface{}{
			"message": "WebSocket connection established",
			"session": session,
		},
	}
	
	if err := c.WriteJSON(welcomeEvent); err != nil {
		log.Printf("Failed to send welcome message: %v", err)
		c.Close()
		return
	}
	
	// Handle the connection using the WebSocket manager
	h.wsManager.HandleWebSocketConnection(c, sessionID, playerID)
}

// GetConnectionStatus returns the status of WebSocket connections for a session
func (h *WebSocketHandler) GetConnectionStatus(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	// Get active connections
	connections := h.wsManager.GetActiveConnections(sessionID)
	
	// Build response
	var activePlayerIDs []string
	for _, conn := range connections {
		activePlayerIDs = append(activePlayerIDs, conn.PlayerID)
	}
	
	return c.JSON(fiber.Map{
		"success":           true,
		"sessionId":         sessionID,
		"activeConnections": len(connections),
		"activePlayers":     activePlayerIDs,
	})
}

// BroadcastMessage broadcasts a message to all players in a session (for testing/admin purposes)
func (h *WebSocketHandler) BroadcastMessage(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Session ID is required",
			"message": "Session ID must be provided in the URL path",
		})
	}
	
	var req struct {
		Type    string      `json:"type" validate:"required"`
		Message interface{} `json:"message" validate:"required"`
	}
	
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}
	
	// Create event
	event := services.WebSocketEvent{
		Type:      req.Type,
		SessionID: sessionID,
		Data:      req.Message,
	}
	
	// Broadcast to session
	if err := h.wsManager.BroadcastToSession(sessionID, event); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to broadcast message",
			"message": err.Error(),
		})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Message broadcasted successfully",
	})
}