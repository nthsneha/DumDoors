package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LeaderboardEntry represents a single entry in the global leaderboard
type LeaderboardEntry struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PlayerID         string             `bson:"playerId" json:"playerId"`
	Username         string             `bson:"username" json:"username"`
	RedditUserID     string             `bson:"redditUserId" json:"redditUserId"`
	CompletionTime   time.Duration      `bson:"completionTime" json:"completionTime"`
	TotalScore       int                `bson:"totalScore" json:"totalScore"`
	AverageScore     float64            `bson:"averageScore" json:"averageScore"`
	DoorsCompleted   int                `bson:"doorsCompleted" json:"doorsCompleted"`
	GameMode         GameMode           `bson:"gameMode" json:"gameMode"`
	Theme            *string            `bson:"theme,omitempty" json:"theme,omitempty"`
	SessionID        string             `bson:"sessionId" json:"sessionId"`
	CompletedAt      time.Time          `bson:"completedAt" json:"completedAt"`
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
}

// GlobalLeaderboard represents different leaderboard categories
type GlobalLeaderboard struct {
	FastestCompletions []LeaderboardEntry `json:"fastestCompletions"`
	HighestAverages    []LeaderboardEntry `json:"highestAverages"`
	MostCompleted      []LeaderboardEntry `json:"mostCompleted"`
	RecentWinners      []LeaderboardEntry `json:"recentWinners"`
}

// LeaderboardStats represents aggregated statistics for leaderboards
type LeaderboardStats struct {
	TotalGamesCompleted int           `json:"totalGamesCompleted"`
	AverageCompletionTime time.Duration `json:"averageCompletionTime"`
	FastestEverTime     time.Duration `json:"fastestEverTime"`
	HighestEverAverage  float64       `json:"highestEverAverage"`
	MostActivePlayer    string        `json:"mostActivePlayer"`
	LastUpdated         time.Time     `json:"lastUpdated"`
}

// LeaderboardFilter represents filtering options for leaderboard queries
type LeaderboardFilter struct {
	GameMode  *GameMode `json:"gameMode,omitempty"`
	Theme     *string   `json:"theme,omitempty"`
	TimeRange *string   `json:"timeRange,omitempty"` // "day", "week", "month", "all"
	Limit     int       `json:"limit"`
}