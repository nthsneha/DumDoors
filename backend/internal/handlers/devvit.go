package handlers

import (
	"dumdoors-backend/internal/models"
	"dumdoors-backend/internal/services"
	"log"

	"github.com/gofiber/fiber/v2"
)

// DevvitHandler handles Devvit-specific requests
type DevvitHandler struct {
	devvitService services.DevvitIntegration
}

// NewDevvitHandler creates a new Devvit handler
func NewDevvitHandler(devvitService services.DevvitIntegration) *DevvitHandler {
	return &DevvitHandler{
		devvitService: devvitService,
	}
}

// InitGame handles the /api/init endpoint - migrated from Express server
func (h *DevvitHandler) InitGame(c *fiber.Ctx) error {
	// Validate Devvit request
	if err := h.devvitService.ValidateDevvitRequest(c); err != nil {
		log.Printf("Devvit validation error: %v", err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid Devvit request",
		})
	}

	// Get post context
	postContext, err := h.devvitService.GetPostContext(c)
	if err != nil {
		log.Printf("API Init Error: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	// Get current user
	user, err := h.devvitService.GetCurrentUser(c)
	if err != nil {
		log.Printf("Error getting current user: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to get user information",
		})
	}

	// Load or create game state
	gameState, err := h.devvitService.LoadGameState(postContext.PostID)
	if err != nil {
		log.Printf("Error loading game state for post %s: %v", postContext.PostID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load game state",
		})
	}

	// Create init response
	response := models.InitResponse{
		Type:     "init",
		PostID:   postContext.PostID,
		Username: user.Username,
		GameData: gameState,
	}

	log.Printf("API Init successful for post %s, user %s", postContext.PostID, user.Username)
	return c.JSON(response)
}

// CreatePost handles post creation requests
func (h *DevvitHandler) CreatePost(c *fiber.Ctx) error {
	// Validate Devvit request
	if err := h.devvitService.ValidateDevvitRequest(c); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid Devvit request",
		})
	}

	// Get post context
	postContext, err := h.devvitService.GetPostContext(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to get post context",
		})
	}

	// Create initial game state for the new post
	gameState := &models.GameState{
		PostID:      postContext.PostID,
		PlayerCount: 0,
		Status:      "waiting",
		CustomData:  make(map[string]interface{}),
	}

	// Store the initial game state
	if err := h.devvitService.StoreGameState(postContext.PostID, gameState); err != nil {
		log.Printf("Error storing initial game state: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to initialize game state",
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Post initialized successfully",
		"postId":  postContext.PostID,
	})
}

// OnAppInstall handles the app installation webhook
func (h *DevvitHandler) OnAppInstall(c *fiber.Ctx) error {
	// This would typically create a default post or perform setup tasks
	// For now, we'll just acknowledge the installation
	
	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "DumDoors app installed successfully",
	})
}

// MenuPostCreate handles the menu-triggered post creation
func (h *DevvitHandler) MenuPostCreate(c *fiber.Ctx) error {
	// Get post context
	postContext, err := h.devvitService.GetPostContext(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to get post context",
		})
	}

	// In a real implementation, this would create a new Reddit post
	// For now, we'll simulate the navigation response
	subredditName := postContext.SubredditName
	if subredditName == "" {
		subredditName = "test" // fallback for development
	}

	return c.JSON(fiber.Map{
		"navigateTo": "https://reddit.com/r/" + subredditName + "/comments/" + postContext.PostID,
	})
}