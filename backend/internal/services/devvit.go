package services

import (
	"dumdoors-backend/internal/models"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// DevvitIntegration interface defines the contract for Devvit operations
type DevvitIntegration interface {
	GetCurrentUser(c *fiber.Ctx) (*models.RedditUser, error)
	GetPostContext(c *fiber.Ctx) (*models.PostContext, error)
	StoreGameState(postID string, state *models.GameState) error
	LoadGameState(postID string) (*models.GameState, error)
	ValidateDevvitRequest(c *fiber.Ctx) error
}

// DevvitIntegrationImpl implements the DevvitIntegration interface
type DevvitIntegrationImpl struct {
	// In a real implementation, this would include Redis client, 
	// authentication tokens, and other Devvit-specific configurations
}

// NewDevvitIntegration creates a new Devvit integration service
func NewDevvitIntegration() DevvitIntegration {
	return &DevvitIntegrationImpl{}
}

// GetCurrentUser extracts the current Reddit user from the request context
func (d *DevvitIntegrationImpl) GetCurrentUser(c *fiber.Ctx) (*models.RedditUser, error) {
	// In a real Devvit integration, this would extract user info from headers or context
	// For now, we'll simulate this with headers that would be set by Devvit
	
	username := c.Get("X-Reddit-Username")
	userID := c.Get("X-Reddit-User-ID")
	
	if username == "" {
		// Fallback to anonymous user for development
		return &models.RedditUser{
			ID:       "anonymous",
			Username: "anonymous",
		}, nil
	}
	
	if userID == "" {
		userID = fmt.Sprintf("user_%s", username)
	}
	
	return &models.RedditUser{
		ID:       userID,
		Username: username,
	}, nil
}

// GetPostContext extracts the post context from the request
func (d *DevvitIntegrationImpl) GetPostContext(c *fiber.Ctx) (*models.PostContext, error) {
	// In a real Devvit integration, this would be provided by the Devvit runtime
	// For now, we'll extract from headers or query parameters
	
	postID := c.Get("X-Reddit-Post-ID")
	if postID == "" {
		postID = c.Query("postId")
	}
	
	subredditName := c.Get("X-Reddit-Subreddit")
	if subredditName == "" {
		subredditName = c.Query("subreddit")
	}
	
	if postID == "" {
		return nil, errors.New("postId is required but missing from context")
	}
	
	return &models.PostContext{
		PostID:        postID,
		SubredditName: subredditName,
	}, nil
}

// StoreGameState stores the game state for a specific post
func (d *DevvitIntegrationImpl) StoreGameState(postID string, state *models.GameState) error {
	// In a real implementation, this would store to Redis or the Devvit key-value store
	// For now, we'll simulate successful storage
	
	if postID == "" {
		return errors.New("postID cannot be empty")
	}
	
	if state == nil {
		return errors.New("state cannot be nil")
	}
	
	// Update timestamps
	state.UpdatedAt = time.Now()
	if state.CreatedAt.IsZero() {
		state.CreatedAt = time.Now()
	}
	
	// In a real implementation:
	// return d.redisClient.Set(fmt.Sprintf("game_state:%s", postID), state, 0).Err()
	
	return nil
}

// LoadGameState loads the game state for a specific post
func (d *DevvitIntegrationImpl) LoadGameState(postID string) (*models.GameState, error) {
	// In a real implementation, this would load from Redis or the Devvit key-value store
	// For now, we'll return a default state
	
	if postID == "" {
		return nil, errors.New("postID cannot be empty")
	}
	
	// In a real implementation:
	// val, err := d.redisClient.Get(fmt.Sprintf("game_state:%s", postID)).Result()
	// if err == redis.Nil {
	//     return nil, nil // No state found
	// }
	// if err != nil {
	//     return nil, err
	// }
	// 
	// var state models.GameState
	// err = json.Unmarshal([]byte(val), &state)
	// return &state, err
	
	// Return default state for development
	return &models.GameState{
		PostID:      postID,
		PlayerCount: 0,
		Status:      "waiting",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		CustomData:  make(map[string]interface{}),
	}, nil
}

// ValidateDevvitRequest validates that the request comes from a valid Devvit context
func (d *DevvitIntegrationImpl) ValidateDevvitRequest(c *fiber.Ctx) error {
	// In a real implementation, this would validate JWT tokens or other Devvit-specific auth
	// For now, we'll do basic validation
	
	userAgent := c.Get("User-Agent")
	if userAgent != "" && strings.Contains(strings.ToLower(userAgent), "devvit") {
		return nil
	}
	
	// Check for Devvit-specific headers
	if c.Get("X-Reddit-Post-ID") != "" || c.Query("postId") != "" {
		return nil
	}
	
	// For development, allow requests without strict validation
	return nil
}

// Helper function to serialize game state to JSON
func (d *DevvitIntegrationImpl) serializeGameState(state *models.GameState) ([]byte, error) {
	return json.Marshal(state)
}

// Helper function to deserialize game state from JSON
func (d *DevvitIntegrationImpl) deserializeGameState(data []byte) (*models.GameState, error) {
	var state models.GameState
	err := json.Unmarshal(data, &state)
	return &state, err
}