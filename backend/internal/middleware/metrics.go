package middleware

import (
	"dumdoors-backend/internal/monitoring"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

// MetricsMiddleware collects HTTP request metrics
func MetricsMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		
		// Process request
		err := c.Next()
		
		// Calculate duration
		duration := time.Since(start)
		
		// Get request details
		method := c.Method()
		path := c.Route().Path
		if path == "" {
			path = c.Path()
		}
		statusCode := c.Response().StatusCode()
		
		// Record metrics
		monitoring.IncrementRequests(method, path, statusCode)
		monitoring.ObserveRequestDuration(method, path, duration)
		
		// Record error metrics if status indicates error
		if statusCode >= 400 {
			errorType := getErrorTypeFromStatus(statusCode)
			monitoring.IncrementErrors(errorType, "http_handler")
		}
		
		return err
	}
}

// getErrorTypeFromStatus maps HTTP status codes to error types
func getErrorTypeFromStatus(statusCode int) string {
	switch {
	case statusCode >= 400 && statusCode < 500:
		return "client_error"
	case statusCode >= 500:
		return "server_error"
	default:
		return "unknown_error"
	}
}

// GameMetricsMiddleware provides game-specific metrics collection
type GameMetricsMiddleware struct {
	collector *monitoring.MetricsCollector
}

// NewGameMetricsMiddleware creates a new game metrics middleware
func NewGameMetricsMiddleware() *GameMetricsMiddleware {
	return &GameMetricsMiddleware{
		collector: monitoring.GetGlobalMetricsCollector(),
	}
}

// TrackGameSession tracks game session metrics
func (gmm *GameMetricsMiddleware) TrackGameSession(sessionID string, action string) {
	labels := map[string]string{
		"session_id": sessionID,
		"action":     action,
	}
	
	counter := gmm.collector.NewCounter("game_session_actions_total", "Total game session actions", labels)
	counter.Inc()
}

// TrackPlayerAction tracks player action metrics
func (gmm *GameMetricsMiddleware) TrackPlayerAction(playerID, sessionID, action string) {
	labels := map[string]string{
		"player_id":  playerID,
		"session_id": sessionID,
		"action":     action,
	}
	
	counter := gmm.collector.NewCounter("player_actions_total", "Total player actions", labels)
	counter.Inc()
}

// TrackDoorGeneration tracks door generation metrics
func (gmm *GameMetricsMiddleware) TrackDoorGeneration(theme string, difficulty int, success bool) {
	labels := map[string]string{
		"theme":      theme,
		"difficulty": strconv.Itoa(difficulty),
		"success":    strconv.FormatBool(success),
	}
	
	counter := gmm.collector.NewCounter("door_generation_total", "Total door generations", labels)
	counter.Inc()
}

// TrackResponseScoring tracks response scoring metrics
func (gmm *GameMetricsMiddleware) TrackResponseScoring(playerID string, score int, success bool) {
	labels := map[string]string{
		"player_id": playerID,
		"success":   strconv.FormatBool(success),
	}
	
	counter := gmm.collector.NewCounter("response_scoring_total", "Total response scorings", labels)
	counter.Inc()
	
	if success {
		histogram := gmm.collector.NewHistogram("response_scores", "Distribution of response scores", labels)
		histogram.Observe(float64(score))
	}
}

// TrackWebSocketConnection tracks WebSocket connection metrics
func (gmm *GameMetricsMiddleware) TrackWebSocketConnection(action string) {
	labels := map[string]string{
		"action": action,
	}
	
	counter := gmm.collector.NewCounter("websocket_connections_total", "Total WebSocket connections", labels)
	counter.Inc()
}

// TrackAIServiceCall tracks AI service call metrics
func (gmm *GameMetricsMiddleware) TrackAIServiceCall(operation string, duration time.Duration, success bool) {
	labels := map[string]string{
		"operation": operation,
		"success":   strconv.FormatBool(success),
	}
	
	counter := gmm.collector.NewCounter("ai_service_calls_total", "Total AI service calls", labels)
	counter.Inc()
	
	histogram := gmm.collector.NewHistogram("ai_service_call_duration_seconds", "AI service call duration", labels)
	histogram.Observe(duration.Seconds())
}

// TrackDatabaseOperation tracks database operation metrics
func (gmm *GameMetricsMiddleware) TrackDatabaseOperation(database, operation string, duration time.Duration, success bool) {
	labels := map[string]string{
		"database":  database,
		"operation": operation,
		"success":   strconv.FormatBool(success),
	}
	
	counter := gmm.collector.NewCounter("database_operations_total", "Total database operations", labels)
	counter.Inc()
	
	histogram := gmm.collector.NewHistogram("database_operation_duration_seconds", "Database operation duration", labels)
	histogram.Observe(duration.Seconds())
}

// Global game metrics middleware instance
var globalGameMetrics *GameMetricsMiddleware

// GetGlobalGameMetrics returns the global game metrics middleware
func GetGlobalGameMetrics() *GameMetricsMiddleware {
	if globalGameMetrics == nil {
		globalGameMetrics = NewGameMetricsMiddleware()
	}
	return globalGameMetrics
}

// Convenience functions for tracking metrics
func TrackGameSession(sessionID string, action string) {
	GetGlobalGameMetrics().TrackGameSession(sessionID, action)
}

func TrackPlayerAction(playerID, sessionID, action string) {
	GetGlobalGameMetrics().TrackPlayerAction(playerID, sessionID, action)
}

func TrackDoorGeneration(theme string, difficulty int, success bool) {
	GetGlobalGameMetrics().TrackDoorGeneration(theme, difficulty, success)
}

func TrackResponseScoring(playerID string, score int, success bool) {
	GetGlobalGameMetrics().TrackResponseScoring(playerID, score, success)
}

func TrackWebSocketConnection(action string) {
	GetGlobalGameMetrics().TrackWebSocketConnection(action)
}

func TrackAIServiceCall(operation string, duration time.Duration, success bool) {
	GetGlobalGameMetrics().TrackAIServiceCall(operation, duration, success)
}

func TrackDatabaseOperation(database, operation string, duration time.Duration, success bool) {
	GetGlobalGameMetrics().TrackDatabaseOperation(database, operation, duration, success)
}