package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GameMode represents the type of game session
type GameMode string

const (
	GameModeMultiplayer  GameMode = "multiplayer"
	GameModeSinglePlayer GameMode = "single-player"
)

// GameStatus represents the current state of a game session
type GameStatus string

const (
	GameStatusWaiting   GameStatus = "waiting"
	GameStatusActive    GameStatus = "active"
	GameStatusCompleted GameStatus = "completed"
)

// GameSession represents a game session in the database
type GameSession struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SessionID   string             `bson:"sessionId" json:"sessionId"`
	Mode        GameMode           `bson:"mode" json:"mode"`
	Theme       *string            `bson:"theme,omitempty" json:"theme,omitempty"`
	Players     []PlayerInfo       `bson:"players" json:"players"`
	Status      GameStatus         `bson:"status" json:"status"`
	CurrentDoor *Door              `bson:"currentDoor,omitempty" json:"currentDoor,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	StartedAt   *time.Time         `bson:"startedAt,omitempty" json:"startedAt,omitempty"`
	CompletedAt *time.Time         `bson:"completedAt,omitempty" json:"completedAt,omitempty"`
}

// PlayerInfo represents a player within a game session
type PlayerInfo struct {
	PlayerID        string           `bson:"playerId" json:"playerId"`
	Username        string           `bson:"username" json:"username"`
	RedditUserID    string           `bson:"redditUserId" json:"redditUserId"`
	JoinedAt        time.Time        `bson:"joinedAt" json:"joinedAt"`
	CurrentPosition int              `bson:"currentPosition" json:"currentPosition"`
	TotalScore      int              `bson:"totalScore" json:"totalScore"`
	Responses       []PlayerResponse `bson:"responses" json:"responses"`
	IsActive        bool             `bson:"isActive" json:"isActive"`
}

// Door represents a game scenario/situation
type Door struct {
	ID                    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	DoorID                string             `bson:"doorId" json:"doorId"`
	Content               string             `bson:"content" json:"content"`
	Theme                 string             `bson:"theme" json:"theme"`
	Difficulty            int                `bson:"difficulty" json:"difficulty"`
	ExpectedSolutionTypes []string           `bson:"expectedSolutionTypes" json:"expectedSolutionTypes"`
	CreatedAt             time.Time          `bson:"createdAt" json:"createdAt"`
}

// PlayerResponse represents a player's response to a door
type PlayerResponse struct {
	ResponseID      string          `bson:"responseId" json:"responseId"`
	DoorID          string          `bson:"doorId" json:"doorId"`
	PlayerID        string          `bson:"playerId" json:"playerId"`
	Content         string          `bson:"content" json:"content"`
	AIScore         int             `bson:"aiScore" json:"aiScore"`
	SubmittedAt     time.Time       `bson:"submittedAt" json:"submittedAt"`
	ScoringMetrics  ScoringMetrics  `bson:"scoringMetrics" json:"scoringMetrics"`
}

// ScoringMetrics represents the detailed scoring breakdown
type ScoringMetrics struct {
	Creativity  int `bson:"creativity" json:"creativity"`
	Feasibility int `bson:"feasibility" json:"feasibility"`
	Humor       int `bson:"humor" json:"humor"`
	Originality int `bson:"originality" json:"originality"`
}