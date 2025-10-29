package handlers

import (
	"dumdoors-backend/internal/middleware"
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ErrorReportingHandler handles client-side error reporting
type ErrorReportingHandler struct{}

// NewErrorReportingHandler creates a new error reporting handler
func NewErrorReportingHandler() *ErrorReportingHandler {
	return &ErrorReportingHandler{}
}

// ClientErrorReport represents an error report from the client
type ClientErrorReport struct {
	ErrorID        string                 `json:"errorId"`
	Message        string                 `json:"message"`
	Stack          string                 `json:"stack"`
	ComponentStack string                 `json:"componentStack,omitempty"`
	Context        string                 `json:"context,omitempty"`
	Timestamp      string                 `json:"timestamp"`
	UserAgent      string                 `json:"userAgent"`
	URL            string                 `json:"url"`
	RetryCount     int                    `json:"retryCount,omitempty"`
	SessionID      string                 `json:"sessionId,omitempty"`
	PlayerID       string                 `json:"playerId,omitempty"`
	GameState      string                 `json:"gameState,omitempty"`
	Additional     map[string]interface{} `json:"additional,omitempty"`
}

// ReportError handles client-side error reports
func (h *ErrorReportingHandler) ReportError(c *fiber.Ctx) error {
	var report ClientErrorReport
	if err := c.BodyParser(&report); err != nil {
		return middleware.ValidationError("Invalid error report format").WithCause(err)
	}

	// Validate required fields
	if report.Message == "" {
		return middleware.ValidationError("Error message is required")
	}

	// Add server-side metadata
	serverReport := map[string]interface{}{
		"client_report":  report,
		"server_timestamp": time.Now().UTC(),
		"client_ip":      c.IP(),
		"request_id":     c.Locals("request_id"),
		"severity":       h.determineSeverity(report),
		"category":       h.categorizeError(report),
	}

	// Log the error report
	h.logErrorReport(serverReport)

	// In a real implementation, you would:
	// 1. Store in error tracking database
	// 2. Send to monitoring service (Sentry, DataDog, etc.)
	// 3. Alert on critical errors
	// 4. Aggregate for analytics

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"success":   true,
		"message":   "Error report received",
		"report_id": report.ErrorID,
	})
}

// GetErrorStats returns error statistics for monitoring
func (h *ErrorReportingHandler) GetErrorStats(c *fiber.Ctx) error {
	// In a real implementation, this would query the error database
	stats := fiber.Map{
		"total_errors":     0,
		"errors_last_24h":  0,
		"errors_last_hour": 0,
		"top_errors": []fiber.Map{
			{
				"message": "WebSocket connection failed",
				"count":   15,
				"last_seen": time.Now().Add(-2 * time.Hour),
			},
			{
				"message": "AI service timeout",
				"count":   8,
				"last_seen": time.Now().Add(-30 * time.Minute),
			},
		},
		"error_categories": fiber.Map{
			"network":    25,
			"validation": 12,
			"timeout":    8,
			"unknown":    5,
		},
	}

	return c.JSON(stats)
}

// determineSeverity determines the severity level of an error
func (h *ErrorReportingHandler) determineSeverity(report ClientErrorReport) string {
	// Check for critical keywords
	criticalKeywords := []string{"crash", "fatal", "panic", "segfault"}
	for _, keyword := range criticalKeywords {
		if contains(report.Message, keyword) || contains(report.Stack, keyword) {
			return "critical"
		}
	}

	// Check for high severity indicators
	highSeverityKeywords := []string{"timeout", "network", "connection", "failed"}
	for _, keyword := range highSeverityKeywords {
		if contains(report.Message, keyword) {
			return "high"
		}
	}

	// Check retry count
	if report.RetryCount > 3 {
		return "high"
	}

	// Check for warning indicators
	warningKeywords := []string{"warning", "deprecated", "fallback"}
	for _, keyword := range warningKeywords {
		if contains(report.Message, keyword) {
			return "medium"
		}
	}

	return "low"
}

// categorizeError categorizes the error for better organization
func (h *ErrorReportingHandler) categorizeError(report ClientErrorReport) string {
	message := report.Message
	context := report.Context

	// Network-related errors
	networkKeywords := []string{"network", "connection", "timeout", "fetch", "websocket"}
	for _, keyword := range networkKeywords {
		if contains(message, keyword) || contains(context, keyword) {
			return "network"
		}
	}

	// Validation errors
	validationKeywords := []string{"validation", "invalid", "required", "format"}
	for _, keyword := range validationKeywords {
		if contains(message, keyword) {
			return "validation"
		}
	}

	// UI/Component errors
	uiKeywords := []string{"component", "render", "props", "state"}
	for _, keyword := range uiKeywords {
		if contains(message, keyword) || contains(report.ComponentStack, keyword) {
			return "ui"
		}
	}

	// Game logic errors
	gameKeywords := []string{"game", "session", "player", "door", "score"}
	for _, keyword := range gameKeywords {
		if contains(message, keyword) || contains(context, keyword) {
			return "game_logic"
		}
	}

	// Authentication/Authorization errors
	authKeywords := []string{"auth", "unauthorized", "forbidden", "token"}
	for _, keyword := range authKeywords {
		if contains(message, keyword) {
			return "authentication"
		}
	}

	return "unknown"
}

// logErrorReport logs the error report with structured logging
func (h *ErrorReportingHandler) logErrorReport(report map[string]interface{}) {
	// Convert to JSON for structured logging
	reportJSON, err := json.Marshal(report)
	if err != nil {
		log.Printf("ERROR_REPORT_MARSHAL_FAILED: %v", err)
		return
	}

	severity := report["severity"].(string)
	category := report["category"].(string)

	// Log with appropriate level based on severity
	switch severity {
	case "critical":
		log.Printf("CLIENT_ERROR_CRITICAL [%s]: %s", category, reportJSON)
	case "high":
		log.Printf("CLIENT_ERROR_HIGH [%s]: %s", category, reportJSON)
	case "medium":
		log.Printf("CLIENT_ERROR_MEDIUM [%s]: %s", category, reportJSON)
	default:
		log.Printf("CLIENT_ERROR_LOW [%s]: %s", category, reportJSON)
	}
}

// Helper function to check if a string contains a substring (case-insensitive)
func contains(text, substring string) bool {
	if len(text) == 0 || len(substring) == 0 {
		return false
	}
	
	// Simple case-insensitive contains check
	textLower := make([]byte, len(text))
	subLower := make([]byte, len(substring))
	
	for i, b := range []byte(text) {
		if b >= 'A' && b <= 'Z' {
			textLower[i] = b + 32
		} else {
			textLower[i] = b
		}
	}
	
	for i, b := range []byte(substring) {
		if b >= 'A' && b <= 'Z' {
			subLower[i] = b + 32
		} else {
			subLower[i] = b
		}
	}
	
	return containsBytes(textLower, subLower)
}

func containsBytes(text, substring []byte) bool {
	if len(substring) > len(text) {
		return false
	}
	
	for i := 0; i <= len(text)-len(substring); i++ {
		match := true
		for j := 0; j < len(substring); j++ {
			if text[i+j] != substring[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}