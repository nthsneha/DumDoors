package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// GameHandler handles game-related HTTP requests
type GameHandler struct {
	// Will be populated with services in later tasks
}

// NewGameHandler creates a new game handler
func NewGameHandler() *GameHandler {
	return &GameHandler{}
}

// GetAPIInfo returns basic API information
func (h *GameHandler) GetAPIInfo(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"message": "DumDoors Game API",
		"version": "1.0.0",
		"status":  "ready",
	})
}