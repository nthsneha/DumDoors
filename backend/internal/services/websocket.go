package services

import (
	"dumdoors-backend/internal/models"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
)

// WebSocketEvent represents different types of events that can be sent via WebSocket
type WebSocketEvent struct {
	Type      string      `json:"type"`
	SessionID string      `json:"sessionId"`
	PlayerID  string      `json:"playerId,omitempty"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
}

// PlayerProgress represents a player's current progress in the game
type PlayerProgress struct {
	PlayerID        string  `json:"playerId"`
	Username        string  `json:"username"`
	CurrentPosition int     `json:"currentPosition"`
	TotalDoors      int     `json:"totalDoors"`
	TotalScore      int     `json:"totalScore"`
	AverageScore    float64 `json:"averageScore"`
	DoorsCompleted  int     `json:"doorsCompleted"`
	IsActive        bool    `json:"isActive"`
	LastResponseAt  *time.Time `json:"lastResponseAt,omitempty"`
}

// SessionProgress represents the overall progress of all players in a session
type SessionProgress struct {
	SessionID       string           `json:"sessionId"`
	Players         []PlayerProgress `json:"players"`
	CurrentDoorID   string           `json:"currentDoorId,omitempty"`
	GameStatus      string           `json:"gameStatus"`
	LeaderPlayerID  string           `json:"leaderPlayerId,omitempty"`
	UpdatedAt       time.Time        `json:"updatedAt"`
}

// WebSocketConnection represents a WebSocket connection with metadata
type WebSocketConnection struct {
	Conn      *websocket.Conn
	PlayerID  string
	SessionID string
	LastSeen  time.Time
	IsActive  bool
	mu        sync.RWMutex
}

// WebSocketManager interface defines the contract for WebSocket operations
type WebSocketManager interface {
	RegisterConnection(sessionID, playerID string, conn *websocket.Conn) error
	UnregisterConnection(playerID string) error
	BroadcastToSession(sessionID string, event WebSocketEvent) error
	SendToPlayer(playerID string, event WebSocketEvent) error
	HandlePlayerDisconnect(playerID string) error
	RestorePlayerConnection(playerID string, conn *websocket.Conn) error
	GetActiveConnections(sessionID string) []*WebSocketConnection
	CleanupInactiveConnections()
	HandleWebSocketConnection(c *websocket.Conn, sessionID, playerID string)
	BroadcastProgressUpdate(sessionID string, progress SessionProgress) error
	BroadcastPlayerPositionUpdate(sessionID, playerID string, position int, totalDoors int) error
	BroadcastScoreUpdate(sessionID, playerID string, newScore int, totalScore int) error
	BroadcastLeaderboardUpdate(sessionID string, leaderboard []PlayerProgress) error
	BroadcastPlayerStatusUpdate(sessionID string, playerProgress PlayerProgress) error
	BroadcastFinalRankings(sessionID string, rankings []models.PlayerRanking) error
	BroadcastPerformanceStatistics(sessionID string, stats []models.PlayerPerformanceStats) error
}

// WebSocketManagerImpl implements the WebSocketManager interface
type WebSocketManagerImpl struct {
	connections map[string]*WebSocketConnection // playerID -> connection
	sessions    map[string][]string             // sessionID -> []playerID
	mu          sync.RWMutex
	
	// Configuration
	disconnectTimeout time.Duration
	pingInterval      time.Duration
}

// NewWebSocketManager creates a new WebSocket manager instance
func NewWebSocketManager() WebSocketManager {
	manager := &WebSocketManagerImpl{
		connections:       make(map[string]*WebSocketConnection),
		sessions:          make(map[string][]string),
		disconnectTimeout: 5 * time.Minute, // 5-minute timeout as per requirements
		pingInterval:      30 * time.Second,
	}
	
	// Start cleanup routine
	go manager.startCleanupRoutine()
	
	return manager
}

// RegisterConnection registers a new WebSocket connection
func (w *WebSocketManagerImpl) RegisterConnection(sessionID, playerID string, conn *websocket.Conn) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	
	// Create new connection
	wsConn := &WebSocketConnection{
		Conn:      conn,
		PlayerID:  playerID,
		SessionID: sessionID,
		LastSeen:  time.Now(),
		IsActive:  true,
	}
	
	// Store connection
	w.connections[playerID] = wsConn
	
	// Add to session
	if _, exists := w.sessions[sessionID]; !exists {
		w.sessions[sessionID] = make([]string, 0)
	}
	
	// Check if player is already in session
	found := false
	for _, pid := range w.sessions[sessionID] {
		if pid == playerID {
			found = true
			break
		}
	}
	
	if !found {
		w.sessions[sessionID] = append(w.sessions[sessionID], playerID)
	}
	
	log.Printf("WebSocket connection registered for player %s in session %s", playerID, sessionID)
	
	// Notify other players in session about new connection
	event := WebSocketEvent{
		Type:      "player-connected",
		SessionID: sessionID,
		PlayerID:  playerID,
		Data: map[string]interface{}{
			"playerId": playerID,
			"message":  "Player connected",
		},
		Timestamp: time.Now(),
	}
	
	// Broadcast to other players (not the connecting player)
	go w.broadcastToOthers(sessionID, playerID, event)
	
	return nil
}

// UnregisterConnection removes a WebSocket connection
func (w *WebSocketManagerImpl) UnregisterConnection(playerID string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	
	conn, exists := w.connections[playerID]
	if !exists {
		return fmt.Errorf("connection not found for player %s", playerID)
	}
	
	sessionID := conn.SessionID
	
	// Mark as inactive but don't remove immediately (for reconnection)
	conn.mu.Lock()
	conn.IsActive = false
	conn.mu.Unlock()
	
	log.Printf("WebSocket connection unregistered for player %s in session %s", playerID, sessionID)
	
	// Notify other players about disconnection
	event := WebSocketEvent{
		Type:      "player-disconnected",
		SessionID: sessionID,
		PlayerID:  playerID,
		Data: map[string]interface{}{
			"playerId": playerID,
			"message":  "Player disconnected",
		},
		Timestamp: time.Now(),
	}
	
	// Broadcast to other players
	go w.broadcastToOthers(sessionID, playerID, event)
	
	return nil
}

// BroadcastToSession sends an event to all active connections in a session
func (w *WebSocketManagerImpl) BroadcastToSession(sessionID string, event WebSocketEvent) error {
	w.mu.RLock()
	playerIDs, exists := w.sessions[sessionID]
	w.mu.RUnlock()
	
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}
	
	var errors []error
	for _, playerID := range playerIDs {
		if err := w.SendToPlayer(playerID, event); err != nil {
			errors = append(errors, fmt.Errorf("failed to send to player %s: %w", playerID, err))
		}
	}
	
	if len(errors) > 0 {
		return fmt.Errorf("broadcast errors: %v", errors)
	}
	
	return nil
}

// SendToPlayer sends an event to a specific player
func (w *WebSocketManagerImpl) SendToPlayer(playerID string, event WebSocketEvent) error {
	w.mu.RLock()
	conn, exists := w.connections[playerID]
	w.mu.RUnlock()
	
	if !exists {
		return fmt.Errorf("connection not found for player %s", playerID)
	}
	
	conn.mu.RLock()
	isActive := conn.IsActive
	wsConn := conn.Conn
	conn.mu.RUnlock()
	
	if !isActive {
		return fmt.Errorf("connection inactive for player %s", playerID)
	}
	
	// Update last seen
	conn.mu.Lock()
	conn.LastSeen = time.Now()
	conn.mu.Unlock()
	
	// Send message
	if err := wsConn.WriteJSON(event); err != nil {
		// Mark connection as inactive on write error
		conn.mu.Lock()
		conn.IsActive = false
		conn.mu.Unlock()
		return fmt.Errorf("failed to send message to player %s: %w", playerID, err)
	}
	
	return nil
}

// HandlePlayerDisconnect handles player disconnection with timeout
func (w *WebSocketManagerImpl) HandlePlayerDisconnect(playerID string) error {
	return w.UnregisterConnection(playerID)
}

// RestorePlayerConnection restores a player's connection after reconnection
func (w *WebSocketManagerImpl) RestorePlayerConnection(playerID string, conn *websocket.Conn) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	
	existingConn, exists := w.connections[playerID]
	if !exists {
		return fmt.Errorf("no previous connection found for player %s", playerID)
	}
	
	// Check if reconnection is within timeout window
	if time.Since(existingConn.LastSeen) > w.disconnectTimeout {
		// Remove from session if timeout exceeded
		w.removePlayerFromSession(existingConn.SessionID, playerID)
		delete(w.connections, playerID)
		return fmt.Errorf("reconnection timeout exceeded for player %s", playerID)
	}
	
	// Update connection
	existingConn.mu.Lock()
	existingConn.Conn = conn
	existingConn.IsActive = true
	existingConn.LastSeen = time.Now()
	existingConn.mu.Unlock()
	
	log.Printf("WebSocket connection restored for player %s in session %s", playerID, existingConn.SessionID)
	
	// Notify other players about reconnection
	event := WebSocketEvent{
		Type:      "player-reconnected",
		SessionID: existingConn.SessionID,
		PlayerID:  playerID,
		Data: map[string]interface{}{
			"playerId": playerID,
			"message":  "Player reconnected",
		},
		Timestamp: time.Now(),
	}
	
	go w.broadcastToOthers(existingConn.SessionID, playerID, event)
	
	return nil
}

// GetActiveConnections returns all active connections for a session
func (w *WebSocketManagerImpl) GetActiveConnections(sessionID string) []*WebSocketConnection {
	w.mu.RLock()
	defer w.mu.RUnlock()
	
	playerIDs, exists := w.sessions[sessionID]
	if !exists {
		return []*WebSocketConnection{}
	}
	
	var activeConnections []*WebSocketConnection
	for _, playerID := range playerIDs {
		if conn, exists := w.connections[playerID]; exists {
			conn.mu.RLock()
			if conn.IsActive {
				activeConnections = append(activeConnections, conn)
			}
			conn.mu.RUnlock()
		}
	}
	
	return activeConnections
}

// CleanupInactiveConnections removes connections that have exceeded the timeout
func (w *WebSocketManagerImpl) CleanupInactiveConnections() {
	w.mu.Lock()
	defer w.mu.Unlock()
	
	now := time.Now()
	var toRemove []string
	
	for playerID, conn := range w.connections {
		conn.mu.RLock()
		isActive := conn.IsActive
		lastSeen := conn.LastSeen
		sessionID := conn.SessionID
		conn.mu.RUnlock()
		
		if !isActive && now.Sub(lastSeen) > w.disconnectTimeout {
			toRemove = append(toRemove, playerID)
			w.removePlayerFromSession(sessionID, playerID)
			log.Printf("Cleaned up inactive connection for player %s", playerID)
		}
	}
	
	for _, playerID := range toRemove {
		delete(w.connections, playerID)
	}
}

// broadcastToOthers sends an event to all players in a session except the specified player
func (w *WebSocketManagerImpl) broadcastToOthers(sessionID, excludePlayerID string, event WebSocketEvent) {
	w.mu.RLock()
	playerIDs, exists := w.sessions[sessionID]
	w.mu.RUnlock()
	
	if !exists {
		return
	}
	
	for _, playerID := range playerIDs {
		if playerID != excludePlayerID {
			if err := w.SendToPlayer(playerID, event); err != nil {
				log.Printf("Failed to send event to player %s: %v", playerID, err)
			}
		}
	}
}

// removePlayerFromSession removes a player from a session's player list
func (w *WebSocketManagerImpl) removePlayerFromSession(sessionID, playerID string) {
	if playerIDs, exists := w.sessions[sessionID]; exists {
		for i, pid := range playerIDs {
			if pid == playerID {
				w.sessions[sessionID] = append(playerIDs[:i], playerIDs[i+1:]...)
				break
			}
		}
		
		// Remove session if no players left
		if len(w.sessions[sessionID]) == 0 {
			delete(w.sessions, sessionID)
		}
	}
}

// startCleanupRoutine starts a background routine to clean up inactive connections
func (w *WebSocketManagerImpl) startCleanupRoutine() {
	ticker := time.NewTicker(1 * time.Minute) // Run cleanup every minute
	defer ticker.Stop()
	
	for range ticker.C {
		w.CleanupInactiveConnections()
	}
}

// HandleWebSocketConnection handles the WebSocket upgrade and message processing
func (w *WebSocketManagerImpl) HandleWebSocketConnection(c *websocket.Conn, sessionID, playerID string) {
	// Register the connection
	if err := w.RegisterConnection(sessionID, playerID, c); err != nil {
		log.Printf("Failed to register WebSocket connection: %v", err)
		c.Close()
		return
	}
	
	defer func() {
		w.UnregisterConnection(playerID)
		c.Close()
	}()
	
	// Handle incoming messages
	for {
		var msg map[string]interface{}
		if err := c.ReadJSON(&msg); err != nil {
			log.Printf("WebSocket read error for player %s: %v", playerID, err)
			break
		}
		
		// Process message (placeholder for future message handling)
		log.Printf("Received WebSocket message from player %s: %v", playerID, msg)
		
		// Echo message back to session (for testing)
		event := WebSocketEvent{
			Type:      "message",
			SessionID: sessionID,
			PlayerID:  playerID,
			Data:      msg,
			Timestamp: time.Now(),
		}
		
		if err := w.BroadcastToSession(sessionID, event); err != nil {
			log.Printf("Failed to broadcast message: %v", err)
		}
	}
}

// BroadcastProgressUpdate broadcasts a complete progress update to all players in a session
func (w *WebSocketManagerImpl) BroadcastProgressUpdate(sessionID string, progress SessionProgress) error {
	event := WebSocketEvent{
		Type:      "progress-update",
		SessionID: sessionID,
		Data:      progress,
		Timestamp: time.Now(),
	}
	
	return w.BroadcastToSession(sessionID, event)
}

// BroadcastPlayerPositionUpdate broadcasts a player's position change to all players in the session
func (w *WebSocketManagerImpl) BroadcastPlayerPositionUpdate(sessionID, playerID string, position int, totalDoors int) error {
	event := WebSocketEvent{
		Type:      "player-position-update",
		SessionID: sessionID,
		PlayerID:  playerID,
		Data: map[string]interface{}{
			"playerId":        playerID,
			"currentPosition": position,
			"totalDoors":      totalDoors,
			"progressPercent": float64(position) / float64(totalDoors) * 100,
		},
		Timestamp: time.Now(),
	}
	
	return w.BroadcastToSession(sessionID, event)
}

// BroadcastScoreUpdate broadcasts a player's score update to all players in the session
func (w *WebSocketManagerImpl) BroadcastScoreUpdate(sessionID, playerID string, newScore int, totalScore int) error {
	event := WebSocketEvent{
		Type:      "player-score-update",
		SessionID: sessionID,
		PlayerID:  playerID,
		Data: map[string]interface{}{
			"playerId":   playerID,
			"newScore":   newScore,
			"totalScore": totalScore,
		},
		Timestamp: time.Now(),
	}
	
	return w.BroadcastToSession(sessionID, event)
}

// BroadcastLeaderboardUpdate broadcasts updated leaderboard to all players in the session
func (w *WebSocketManagerImpl) BroadcastLeaderboardUpdate(sessionID string, leaderboard []PlayerProgress) error {
	event := WebSocketEvent{
		Type:      "leaderboard-update",
		SessionID: sessionID,
		Data: map[string]interface{}{
			"leaderboard": leaderboard,
			"message":     "Leaderboard updated",
		},
		Timestamp: time.Now(),
	}
	
	return w.BroadcastToSession(sessionID, event)
}

// BroadcastPlayerStatusUpdate broadcasts a comprehensive player status update
func (w *WebSocketManagerImpl) BroadcastPlayerStatusUpdate(sessionID string, playerProgress PlayerProgress) error {
	event := WebSocketEvent{
		Type:      "player-status-update",
		SessionID: sessionID,
		PlayerID:  playerProgress.PlayerID,
		Data: map[string]interface{}{
			"playerId":         playerProgress.PlayerID,
			"username":         playerProgress.Username,
			"currentPosition":  playerProgress.CurrentPosition,
			"totalDoors":       playerProgress.TotalDoors,
			"totalScore":       playerProgress.TotalScore,
			"averageScore":     playerProgress.AverageScore,
			"doorsCompleted":   playerProgress.DoorsCompleted,
			"isActive":         playerProgress.IsActive,
			"progressPercent":  float64(playerProgress.CurrentPosition) / float64(playerProgress.TotalDoors) * 100,
		},
		Timestamp: time.Now(),
	}
	
	return w.BroadcastToSession(sessionID, event)
}

// BroadcastFinalRankings broadcasts the final rankings when the game is completed
func (w *WebSocketManagerImpl) BroadcastFinalRankings(sessionID string, rankings []models.PlayerRanking) error {
	event := WebSocketEvent{
		Type:      "final-rankings",
		SessionID: sessionID,
		Data: map[string]interface{}{
			"rankings": rankings,
			"message":  "Final rankings calculated",
		},
		Timestamp: time.Now(),
	}
	
	return w.BroadcastToSession(sessionID, event)
}

// BroadcastPerformanceStatistics broadcasts detailed performance statistics for all players
func (w *WebSocketManagerImpl) BroadcastPerformanceStatistics(sessionID string, stats []models.PlayerPerformanceStats) error {
	event := WebSocketEvent{
		Type:      "performance-statistics",
		SessionID: sessionID,
		Data: map[string]interface{}{
			"statistics": stats,
			"message":    "Performance statistics calculated",
		},
		Timestamp: time.Now(),
	}
	
	return w.BroadcastToSession(sessionID, event)
}