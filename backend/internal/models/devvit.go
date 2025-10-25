package models

import "time"

// RedditUser represents a Reddit user from Devvit context
type RedditUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// PostContext represents the Devvit post context
type PostContext struct {
	PostID        string `json:"postId"`
	SubredditName string `json:"subredditName"`
}

// GameState represents the current state stored in Devvit
type GameState struct {
	PostID      string                 `json:"postId"`
	GameMode    string                 `json:"gameMode,omitempty"`
	SessionID   string                 `json:"sessionId,omitempty"`
	PlayerCount int                    `json:"playerCount"`
	Status      string                 `json:"status"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
	CustomData  map[string]interface{} `json:"customData,omitempty"`
}

// InitResponse represents the response for the /api/init endpoint
type InitResponse struct {
	Type     string `json:"type"`
	PostID   string `json:"postId"`
	Username string `json:"username"`
	GameData *GameState `json:"gameData,omitempty"`
}