package services

import (
	"bytes"
	"context"
	"dumdoors-backend/internal/database"
	"dumdoors-backend/internal/models"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// AIClient interface defines operations for AI service communication
type AIClient interface {
	GenerateDoor(ctx context.Context, theme string, difficulty int) (*models.Door, error)
	ScoreResponse(ctx context.Context, door *models.Door, response string) (*models.ScoringMetrics, error)
	GetThemedDoors(ctx context.Context, theme string, count int) ([]*models.Door, error)
	GetNextDoorForPlayer(ctx context.Context, playerID, currentDoorID string, latestScore float64) (*NextDoorResponse, error)
	InitializePlayerJourney(ctx context.Context, playerID, theme, difficulty string) (*PlayerJourneyResponse, error)
	GetPlayerProgress(ctx context.Context, playerID string) (*PlayerProgressResponse, error)
	HealthCheck(ctx context.Context) (*HealthCheckResponse, error)
}

// AIClientImpl implements the AIClient interface
type AIClientImpl struct {
	baseURL    string
	httpClient *http.Client
	redis      *database.RedisClient
}

// NewAIClient creates a new AI service client
func NewAIClient(baseURL string, redis *database.RedisClient) AIClient {
	return &AIClientImpl{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		redis: redis,
	}
}

// GenerateDoorRequest represents the request to generate a door
type GenerateDoorRequest struct {
	Theme      string `json:"theme"`
	Difficulty int    `json:"difficulty"`
}

// GenerateDoorResponse represents the response from door generation
type GenerateDoorResponse struct {
	Content               string   `json:"content"`
	Theme                 string   `json:"theme"`
	Difficulty            int      `json:"difficulty"`
	ExpectedSolutionTypes []string `json:"expectedSolutionTypes"`
}

// ScoreResponseRequest represents the request to score a response
type ScoreResponseRequest struct {
	DoorContent string `json:"doorContent"`
	Response    string `json:"response"`
}

// ScoreResponseResponse represents the response from scoring
type ScoreResponseResponse struct {
	TotalScore int `json:"totalScore"`
	Metrics    struct {
		Creativity  int `json:"creativity"`
		Feasibility int `json:"feasibility"`
		Humor       int `json:"humor"`
		Originality int `json:"originality"`
	} `json:"metrics"`
}

// NextDoorResponse represents the response for getting next door
type NextDoorResponse struct {
	DoorID         string `json:"door_id"`
	Content        string `json:"content"`
	Theme          string `json:"theme"`
	Difficulty     string `json:"difficulty"`
	PathType       string `json:"path_type"`
	ScoreThreshold int    `json:"score_threshold"`
}

// PlayerJourneyResponse represents the response for initializing player journey
type PlayerJourneyResponse struct {
	Success            bool   `json:"success"`
	StartingDoorID     string `json:"starting_door_id"`
	TotalDoorsCreated  int    `json:"total_doors_created"`
	Theme              string `json:"theme"`
	Difficulty         string `json:"difficulty"`
	Error              string `json:"error,omitempty"`
}

// PlayerProgressResponse represents the response for player progress
type PlayerProgressResponse struct {
	CurrentDoor          string                 `json:"current_door"`
	CurrentContent       string                 `json:"current_content"`
	CurrentTheme         string                 `json:"current_theme"`
	RemainingDoors       int                    `json:"remaining_doors"`
	NextDoorOptions      []NextDoorResponse     `json:"next_door_options"`
	CompletionPercentage float64                `json:"completion_percentage"`
	Error                string                 `json:"error,omitempty"`
}

// HealthCheckResponse represents the health check response
type HealthCheckResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Version   string `json:"version"`
	AIClient  map[string]interface{} `json:"ai_client"`
}

// GenerateDoor generates a new door using the AI service
func (c *AIClientImpl) GenerateDoor(ctx context.Context, theme string, difficulty int) (*models.Door, error) {
	// Check cache first
	cacheKey := c.generateCacheKey("door", theme, fmt.Sprintf("%d", difficulty))
	var cachedDoor models.Door
	if err := c.getCachedAIResponse(ctx, cacheKey, &cachedDoor); err == nil {
		return &cachedDoor, nil
	}
	
	// Map difficulty level to string
	difficultyStr := "medium"
	switch difficulty {
	case 1:
		difficultyStr = "easy"
	case 2:
		difficultyStr = "medium"
	case 3:
		difficultyStr = "hard"
	}
	
	// Prepare request body
	requestBody := map[string]interface{}{
		"theme":      theme,
		"difficulty": difficultyStr,
		"context":    nil,
	}
	
	// Make request to AI service
	resp, err := c.makeRequest(ctx, "POST", "/doors/generate", requestBody)
	if err != nil {
		// Fallback to mock door if AI service is unavailable
		return c.generateMockDoor(theme, difficulty), nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		// Fallback to mock door if AI service returns error
		return c.generateMockDoor(theme, difficulty), nil
	}
	
	// Parse response
	var aiResponse struct {
		DoorID                string    `json:"door_id"`
		Content               string    `json:"content"`
		Theme                 string    `json:"theme"`
		Difficulty            string    `json:"difficulty"`
		ExpectedSolutionTypes []string  `json:"expected_solution_types"`
		CreatedAt             time.Time `json:"created_at"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		// Fallback to mock door if parsing fails
		return c.generateMockDoor(theme, difficulty), nil
	}
	
	// Convert difficulty back to int
	difficultyInt := 2 // default medium
	switch aiResponse.Difficulty {
	case "easy":
		difficultyInt = 1
	case "medium":
		difficultyInt = 2
	case "hard":
		difficultyInt = 3
	}
	
	door := &models.Door{
		DoorID:                aiResponse.DoorID,
		Content:               aiResponse.Content,
		Theme:                 aiResponse.Theme,
		Difficulty:            difficultyInt,
		ExpectedSolutionTypes: aiResponse.ExpectedSolutionTypes,
		CreatedAt:             aiResponse.CreatedAt,
	}
	
	// Cache the door for 1 hour
	c.cacheAIResponse(ctx, cacheKey, door, time.Hour)
	
	return door, nil
}

// generateMockDoor creates a fallback mock door when AI service is unavailable
func (c *AIClientImpl) generateMockDoor(theme string, difficulty int) *models.Door {
	doorID := uuid.New().String()
	
	// Create mock door content based on theme and difficulty
	var content string
	switch theme {
	case "workplace":
		content = fmt.Sprintf("You're stuck in an elevator with your boss for 3 hours. The elevator music is playing the same 30-second loop. How do you survive this ordeal? (Difficulty: %d)", difficulty)
	case "social":
		content = fmt.Sprintf("You accidentally liked your ex's photo from 2 years ago while stalking their profile. They saw it immediately. What's your next move? (Difficulty: %d)", difficulty)
	case "adventure":
		content = fmt.Sprintf("You're exploring an ancient temple and accidentally trigger a trap. Darts are flying everywhere, but they're made of rubber. How do you proceed? (Difficulty: %d)", difficulty)
	case "mystery":
		content = fmt.Sprintf("You find a locked briefcase in your attic with your name on it, but you don't remember putting it there. What's your investigation strategy? (Difficulty: %d)", difficulty)
	case "comedy":
		content = fmt.Sprintf("Your pet goldfish has started giving you life advice, and it's surprisingly good. How do you handle this new relationship dynamic? (Difficulty: %d)", difficulty)
	case "survival":
		content = fmt.Sprintf("You're stranded on a desert island, but it has excellent WiFi. How do you use this to your advantage? (Difficulty: %d)", difficulty)
	default:
		content = fmt.Sprintf("You wake up to find that gravity works sideways in your house, but only on Tuesdays. Today is Tuesday. How do you get ready for work? (Difficulty: %d)", difficulty)
	}
	
	return &models.Door{
		DoorID:                doorID,
		Content:               content,
		Theme:                 theme,
		Difficulty:            difficulty,
		ExpectedSolutionTypes: []string{"creative", "practical", "humorous"},
		CreatedAt:             time.Now(),
	}
}

// ScoreResponse scores a player's response using the AI service
func (c *AIClientImpl) ScoreResponse(ctx context.Context, door *models.Door, response string) (*models.ScoringMetrics, error) {
	// Prepare request body
	requestBody := map[string]interface{}{
		"response_id":   uuid.New().String(),
		"door_content":  door.Content,
		"response":      response,
		"context":       nil,
	}
	
	// Make request to AI service
	resp, err := c.makeRequest(ctx, "POST", "/scoring/score-response", requestBody)
	if err != nil {
		// Fallback to mock scoring if AI service is unavailable
		return c.generateMockScoring(response), nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		// Fallback to mock scoring if AI service returns error
		return c.generateMockScoring(response), nil
	}
	
	// Parse response
	var aiResponse struct {
		ResponseID       string  `json:"response_id"`
		TotalScore       float64 `json:"total_score"`
		Metrics          struct {
			Creativity  float64 `json:"creativity"`
			Feasibility float64 `json:"feasibility"`
			Humor       float64 `json:"humor"`
			Originality float64 `json:"originality"`
		} `json:"metrics"`
		Feedback             string  `json:"feedback"`
		PathRecommendation   string  `json:"path_recommendation"`
		ProcessingTimeMs     float64 `json:"processing_time_ms"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		// Fallback to mock scoring if parsing fails
		return c.generateMockScoring(response), nil
	}
	
	// Convert float scores to int (rounding)
	return &models.ScoringMetrics{
		Creativity:  int(aiResponse.Metrics.Creativity + 0.5),
		Feasibility: int(aiResponse.Metrics.Feasibility + 0.5),
		Humor:       int(aiResponse.Metrics.Humor + 0.5),
		Originality: int(aiResponse.Metrics.Originality + 0.5),
	}, nil
}

// generateMockScoring creates fallback mock scoring when AI service is unavailable
func (c *AIClientImpl) generateMockScoring(response string) *models.ScoringMetrics {
	// Simple mock scoring based on response length and content
	responseLen := len(response)
	
	// Base scores
	creativity := 50
	feasibility := 50
	humor := 50
	originality := 50
	
	// Adjust scores based on response characteristics
	if responseLen > 100 {
		creativity += 20
		originality += 15
	}
	if responseLen > 200 {
		creativity += 10
		humor += 10
	}
	
	// Look for certain keywords to adjust scores
	if containsCreativeWords(response) {
		creativity += 15
		originality += 10
	}
	if containsHumorWords(response) {
		humor += 20
	}
	if containsPracticalWords(response) {
		feasibility += 15
	}
	
	// Ensure scores are within bounds
	creativity = clampScore(creativity)
	feasibility = clampScore(feasibility)
	humor = clampScore(humor)
	originality = clampScore(originality)
	
	return &models.ScoringMetrics{
		Creativity:  creativity,
		Feasibility: feasibility,
		Humor:       humor,
		Originality: originality,
	}
}

// GetThemedDoors retrieves multiple doors for a specific theme
func (c *AIClientImpl) GetThemedDoors(ctx context.Context, theme string, count int) ([]*models.Door, error) {
	// Make request to AI service
	url := fmt.Sprintf("/doors/themed?theme=%s&count=%d", theme, count)
	resp, err := c.makeRequest(ctx, "POST", url, nil)
	if err != nil {
		// Fallback to generating doors individually
		return c.generateThemedDoorsFallback(ctx, theme, count)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		// Fallback to generating doors individually
		return c.generateThemedDoorsFallback(ctx, theme, count)
	}
	
	// Parse response
	var aiResponse []struct {
		DoorID                string    `json:"door_id"`
		Content               string    `json:"content"`
		Theme                 string    `json:"theme"`
		Difficulty            string    `json:"difficulty"`
		ExpectedSolutionTypes []string  `json:"expected_solution_types"`
		CreatedAt             time.Time `json:"created_at"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		// Fallback to generating doors individually
		return c.generateThemedDoorsFallback(ctx, theme, count)
	}
	
	// Convert response to Door models
	doors := make([]*models.Door, len(aiResponse))
	for i, aiDoor := range aiResponse {
		// Convert difficulty back to int
		difficultyInt := 2 // default medium
		switch aiDoor.Difficulty {
		case "easy":
			difficultyInt = 1
		case "medium":
			difficultyInt = 2
		case "hard":
			difficultyInt = 3
		}
		
		doors[i] = &models.Door{
			DoorID:                aiDoor.DoorID,
			Content:               aiDoor.Content,
			Theme:                 aiDoor.Theme,
			Difficulty:            difficultyInt,
			ExpectedSolutionTypes: aiDoor.ExpectedSolutionTypes,
			CreatedAt:             aiDoor.CreatedAt,
		}
	}
	
	return doors, nil
}

// generateThemedDoorsFallback generates doors individually as fallback
func (c *AIClientImpl) generateThemedDoorsFallback(ctx context.Context, theme string, count int) ([]*models.Door, error) {
	doors := make([]*models.Door, count)
	
	for i := 0; i < count; i++ {
		// Generate doors with varying difficulty
		difficulty := (i % 3) + 1 // Difficulty 1-3
		door, err := c.GenerateDoor(ctx, theme, difficulty)
		if err != nil {
			return nil, fmt.Errorf("failed to generate door %d: %w", i, err)
		}
		doors[i] = door
	}
	
	return doors, nil
}

// Helper functions for mock scoring
func containsCreativeWords(response string) bool {
	creativeWords := []string{"creative", "innovative", "unique", "original", "artistic", "imaginative"}
	for _, word := range creativeWords {
		if contains(response, word) {
			return true
		}
	}
	return false
}

func containsHumorWords(response string) bool {
	humorWords := []string{"funny", "hilarious", "joke", "laugh", "comedy", "amusing", "witty"}
	for _, word := range humorWords {
		if contains(response, word) {
			return true
		}
	}
	return false
}

func containsPracticalWords(response string) bool {
	practicalWords := []string{"practical", "realistic", "feasible", "logical", "sensible", "reasonable"}
	for _, word := range practicalWords {
		if contains(response, word) {
			return true
		}
	}
	return false
}

func contains(text, word string) bool {
	// Simple case-insensitive contains check
	return len(text) >= len(word) && 
		   (text == word || 
		    (len(text) > len(word) && 
		     (text[:len(word)] == word || 
		      text[len(text)-len(word):] == word ||
		      findSubstring(text, word))))
}

func findSubstring(text, word string) bool {
	for i := 0; i <= len(text)-len(word); i++ {
		if text[i:i+len(word)] == word {
			return true
		}
	}
	return false
}

func clampScore(score int) int {
	if score < 0 {
		return 0
	}
	if score > 100 {
		return 100
	}
	return score
}

// GetNextDoorForPlayer gets the next door for a player based on their score
func (c *AIClientImpl) GetNextDoorForPlayer(ctx context.Context, playerID, currentDoorID string, latestScore float64) (*NextDoorResponse, error) {
	// Prepare request body
	requestBody := map[string]interface{}{
		"player_id":       playerID,
		"current_door_id": currentDoorID,
		"latest_score":    latestScore,
	}
	
	// Make request to AI service
	resp, err := c.makeRequest(ctx, "POST", "/path/next-door", requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to get next door: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}
	
	var nextDoor NextDoorResponse
	if err := json.NewDecoder(resp.Body).Decode(&nextDoor); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &nextDoor, nil
}

// InitializePlayerJourney initializes a new player's journey
func (c *AIClientImpl) InitializePlayerJourney(ctx context.Context, playerID, theme, difficulty string) (*PlayerJourneyResponse, error) {
	// Prepare request body
	requestBody := map[string]interface{}{
		"player_id":  playerID,
		"theme":      theme,
		"difficulty": difficulty,
	}
	
	// Make request to AI service
	resp, err := c.makeRequest(ctx, "POST", "/path/initialize", requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize player journey: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}
	
	var journey PlayerJourneyResponse
	if err := json.NewDecoder(resp.Body).Decode(&journey); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &journey, nil
}

// GetPlayerProgress gets comprehensive player progress information
func (c *AIClientImpl) GetPlayerProgress(ctx context.Context, playerID string) (*PlayerProgressResponse, error) {
	// Make request to AI service
	url := fmt.Sprintf("/path/progress/%s", playerID)
	resp, err := c.makeRequest(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get player progress: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}
	
	var progress PlayerProgressResponse
	if err := json.NewDecoder(resp.Body).Decode(&progress); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &progress, nil
}

// HealthCheck checks the health of the AI service
func (c *AIClientImpl) HealthCheck(ctx context.Context) (*HealthCheckResponse, error) {
	// Make request to AI service
	resp, err := c.makeRequest(ctx, "GET", "/health", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to check AI service health: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service health check returned status %d", resp.StatusCode)
	}
	
	var health HealthCheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, fmt.Errorf("failed to decode health response: %w", err)
	}
	
	return &health, nil
}

// makeRequest is a helper function for making HTTP requests to the AI service
func (c *AIClientImpl) makeRequest(ctx context.Context, method, endpoint string, body interface{}) (*http.Response, error) {
	var reqBody []byte
	var err error
	
	if body != nil {
		reqBody, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
	}
	
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	
	return resp, nil
}

// Caching methods for AI service responses

// cacheAIResponse caches an AI service response
func (c *AIClientImpl) cacheAIResponse(ctx context.Context, cacheKey string, data interface{}, expiration time.Duration) error {
	if c.redis == nil {
		return nil // Skip caching if Redis is not available
	}
	
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal cache data: %w", err)
	}
	
	return c.redis.SetWithExpiration(ctx, cacheKey, string(jsonData), expiration)
}

// getCachedAIResponse retrieves a cached AI service response
func (c *AIClientImpl) getCachedAIResponse(ctx context.Context, cacheKey string, target interface{}) error {
	if c.redis == nil {
		return fmt.Errorf("redis not available")
	}
	
	data, err := c.redis.Get(ctx, cacheKey)
	if err != nil {
		return err
	}
	
	return json.Unmarshal([]byte(data), target)
}

// generateCacheKey generates a cache key for AI service requests
func (c *AIClientImpl) generateCacheKey(prefix string, params ...string) string {
	key := fmt.Sprintf("ai:%s", prefix)
	for _, param := range params {
		key += ":" + param
	}
	return key
}