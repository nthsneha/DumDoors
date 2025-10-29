package repositories

import (
	"context"
	"dumdoors-backend/internal/database"
	"dumdoors-backend/internal/models"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// LeaderboardRepository interface defines operations for leaderboard management
type LeaderboardRepository interface {
	AddEntry(ctx context.Context, entry *models.LeaderboardEntry) error
	GetFastestCompletions(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error)
	GetHighestAverageScores(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error)
	GetMostCompleted(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error)
	GetRecentWinners(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error)
	GetGlobalLeaderboard(ctx context.Context, filter models.LeaderboardFilter) (*models.GlobalLeaderboard, error)
	GetLeaderboardStats(ctx context.Context) (*models.LeaderboardStats, error)
	GetPlayerRank(ctx context.Context, playerID string, category string) (int, error)
}

// LeaderboardRepositoryImpl implements the LeaderboardRepository interface
type LeaderboardRepositoryImpl struct {
	collection *mongo.Collection
	redis      *database.RedisClient
}

// NewLeaderboardRepository creates a new leaderboard repository
func NewLeaderboardRepository(mongodb *database.MongoClient, redis *database.RedisClient) LeaderboardRepository {
	return &LeaderboardRepositoryImpl{
		collection: mongodb.GetCollection("leaderboard_entries"),
		redis:      redis,
	}
}

// AddEntry adds a new leaderboard entry
func (r *LeaderboardRepositoryImpl) AddEntry(ctx context.Context, entry *models.LeaderboardEntry) error {
	entry.CreatedAt = time.Now()
	
	_, err := r.collection.InsertOne(ctx, entry)
	if err != nil {
		return fmt.Errorf("failed to add leaderboard entry: %w", err)
	}
	
	// Update Redis leaderboards for fast access
	if err := r.updateRedisLeaderboards(ctx, entry); err != nil {
		// Log error but don't fail the operation
		fmt.Printf("Warning: failed to update Redis leaderboards: %v\n", err)
	}
	
	return nil
}

// GetFastestCompletions retrieves the fastest completion times
func (r *LeaderboardRepositoryImpl) GetFastestCompletions(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Try Redis cache first
	if entries, err := r.getCachedLeaderboard(ctx, "fastest", filter); err == nil && len(entries) > 0 {
		return entries, nil
	}
	
	// Build MongoDB filter
	mongoFilter := r.buildMongoFilter(filter)
	
	// Sort by completion time (ascending - fastest first)
	opts := options.Find().
		SetSort(bson.D{{Key: "completionTime", Value: 1}}).
		SetLimit(int64(filter.Limit))
	
	cursor, err := r.collection.Find(ctx, mongoFilter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get fastest completions: %w", err)
	}
	defer cursor.Close(ctx)
	
	var entries []models.LeaderboardEntry
	if err := cursor.All(ctx, &entries); err != nil {
		return nil, fmt.Errorf("failed to decode fastest completions: %w", err)
	}
	
	// Cache results
	if err := r.cacheLeaderboard(ctx, "fastest", filter, entries); err != nil {
		fmt.Printf("Warning: failed to cache fastest completions: %v\n", err)
	}
	
	return entries, nil
}

// GetHighestAverageScores retrieves the highest average scores
func (r *LeaderboardRepositoryImpl) GetHighestAverageScores(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Try Redis cache first
	if entries, err := r.getCachedLeaderboard(ctx, "highest_avg", filter); err == nil && len(entries) > 0 {
		return entries, nil
	}
	
	// Build MongoDB filter
	mongoFilter := r.buildMongoFilter(filter)
	
	// Sort by average score (descending - highest first)
	opts := options.Find().
		SetSort(bson.D{{Key: "averageScore", Value: -1}}).
		SetLimit(int64(filter.Limit))
	
	cursor, err := r.collection.Find(ctx, mongoFilter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get highest average scores: %w", err)
	}
	defer cursor.Close(ctx)
	
	var entries []models.LeaderboardEntry
	if err := cursor.All(ctx, &entries); err != nil {
		return nil, fmt.Errorf("failed to decode highest average scores: %w", err)
	}
	
	// Cache results
	if err := r.cacheLeaderboard(ctx, "highest_avg", filter, entries); err != nil {
		fmt.Printf("Warning: failed to cache highest average scores: %v\n", err)
	}
	
	return entries, nil
}

// GetMostCompleted retrieves players with most completed games
func (r *LeaderboardRepositoryImpl) GetMostCompleted(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Try Redis cache first
	if entries, err := r.getCachedLeaderboard(ctx, "most_completed", filter); err == nil && len(entries) > 0 {
		return entries, nil
	}
	
	// Build MongoDB filter
	mongoFilter := r.buildMongoFilter(filter)
	
	// Sort by doors completed (descending - most first)
	opts := options.Find().
		SetSort(bson.D{{Key: "doorsCompleted", Value: -1}}).
		SetLimit(int64(filter.Limit))
	
	cursor, err := r.collection.Find(ctx, mongoFilter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get most completed: %w", err)
	}
	defer cursor.Close(ctx)
	
	var entries []models.LeaderboardEntry
	if err := cursor.All(ctx, &entries); err != nil {
		return nil, fmt.Errorf("failed to decode most completed: %w", err)
	}
	
	// Cache results
	if err := r.cacheLeaderboard(ctx, "most_completed", filter, entries); err != nil {
		fmt.Printf("Warning: failed to cache most completed: %v\n", err)
	}
	
	return entries, nil
}

// GetRecentWinners retrieves recent game winners
func (r *LeaderboardRepositoryImpl) GetRecentWinners(ctx context.Context, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Try Redis cache first
	if entries, err := r.getCachedLeaderboard(ctx, "recent_winners", filter); err == nil && len(entries) > 0 {
		return entries, nil
	}
	
	// Build MongoDB filter
	mongoFilter := r.buildMongoFilter(filter)
	
	// Sort by completion date (descending - most recent first)
	opts := options.Find().
		SetSort(bson.D{{Key: "completedAt", Value: -1}}).
		SetLimit(int64(filter.Limit))
	
	cursor, err := r.collection.Find(ctx, mongoFilter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent winners: %w", err)
	}
	defer cursor.Close(ctx)
	
	var entries []models.LeaderboardEntry
	if err := cursor.All(ctx, &entries); err != nil {
		return nil, fmt.Errorf("failed to decode recent winners: %w", err)
	}
	
	// Cache results
	if err := r.cacheLeaderboard(ctx, "recent_winners", filter, entries); err != nil {
		fmt.Printf("Warning: failed to cache recent winners: %v\n", err)
	}
	
	return entries, nil
}

// GetGlobalLeaderboard retrieves all leaderboard categories
func (r *LeaderboardRepositoryImpl) GetGlobalLeaderboard(ctx context.Context, filter models.LeaderboardFilter) (*models.GlobalLeaderboard, error) {
	// Get all categories concurrently
	fastestCh := make(chan []models.LeaderboardEntry, 1)
	highestCh := make(chan []models.LeaderboardEntry, 1)
	mostCompletedCh := make(chan []models.LeaderboardEntry, 1)
	recentCh := make(chan []models.LeaderboardEntry, 1)
	
	errCh := make(chan error, 4)
	
	// Fetch fastest completions
	go func() {
		entries, err := r.GetFastestCompletions(ctx, filter)
		if err != nil {
			errCh <- err
			return
		}
		fastestCh <- entries
	}()
	
	// Fetch highest averages
	go func() {
		entries, err := r.GetHighestAverageScores(ctx, filter)
		if err != nil {
			errCh <- err
			return
		}
		highestCh <- entries
	}()
	
	// Fetch most completed
	go func() {
		entries, err := r.GetMostCompleted(ctx, filter)
		if err != nil {
			errCh <- err
			return
		}
		mostCompletedCh <- entries
	}()
	
	// Fetch recent winners
	go func() {
		entries, err := r.GetRecentWinners(ctx, filter)
		if err != nil {
			errCh <- err
			return
		}
		recentCh <- entries
	}()
	
	// Collect results
	leaderboard := &models.GlobalLeaderboard{}
	for i := 0; i < 4; i++ {
		select {
		case fastest := <-fastestCh:
			leaderboard.FastestCompletions = fastest
		case highest := <-highestCh:
			leaderboard.HighestAverages = highest
		case mostCompleted := <-mostCompletedCh:
			leaderboard.MostCompleted = mostCompleted
		case recent := <-recentCh:
			leaderboard.RecentWinners = recent
		case err := <-errCh:
			return nil, fmt.Errorf("failed to get global leaderboard: %w", err)
		}
	}
	
	return leaderboard, nil
}

// GetLeaderboardStats retrieves aggregated leaderboard statistics
func (r *LeaderboardRepositoryImpl) GetLeaderboardStats(ctx context.Context) (*models.LeaderboardStats, error) {
	// Try Redis cache first
	if stats, err := r.getCachedStats(ctx); err == nil && stats != nil {
		return stats, nil
	}
	
	// Aggregate statistics from MongoDB
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":                   nil,
				"totalGamesCompleted":   bson.M{"$sum": 1},
				"averageCompletionTime": bson.M{"$avg": "$completionTime"},
				"fastestEverTime":       bson.M{"$min": "$completionTime"},
				"highestEverAverage":    bson.M{"$max": "$averageScore"},
			},
		},
	}
	
	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate leaderboard stats: %w", err)
	}
	defer cursor.Close(ctx)
	
	var result []bson.M
	if err := cursor.All(ctx, &result); err != nil {
		return nil, fmt.Errorf("failed to decode leaderboard stats: %w", err)
	}
	
	if len(result) == 0 {
		return &models.LeaderboardStats{
			LastUpdated: time.Now(),
		}, nil
	}
	
	data := result[0]
	stats := &models.LeaderboardStats{
		TotalGamesCompleted:   int(data["totalGamesCompleted"].(int32)),
		AverageCompletionTime: time.Duration(data["averageCompletionTime"].(int64)),
		FastestEverTime:       time.Duration(data["fastestEverTime"].(int64)),
		HighestEverAverage:    data["highestEverAverage"].(float64),
		LastUpdated:           time.Now(),
	}
	
	// Find most active player
	mostActivePlayer, err := r.getMostActivePlayer(ctx)
	if err == nil {
		stats.MostActivePlayer = mostActivePlayer
	}
	
	// Cache stats for 5 minutes
	if err := r.cacheStats(ctx, stats); err != nil {
		fmt.Printf("Warning: failed to cache leaderboard stats: %v\n", err)
	}
	
	return stats, nil
}

// GetPlayerRank retrieves a player's rank in a specific category
func (r *LeaderboardRepositoryImpl) GetPlayerRank(ctx context.Context, playerID string, category string) (int, error) {
	var sortField string
	var sortOrder int
	
	switch category {
	case "fastest":
		sortField = "completionTime"
		sortOrder = 1 // ascending
	case "highest_avg":
		sortField = "averageScore"
		sortOrder = -1 // descending
	case "most_completed":
		sortField = "doorsCompleted"
		sortOrder = -1 // descending
	default:
		return 0, fmt.Errorf("invalid category: %s", category)
	}
	
	// Count entries better than this player
	pipeline := []bson.M{
		{
			"$match": bson.M{
				"playerId": playerID,
			},
		},
		{
			"$lookup": bson.M{
				"from": "leaderboard_entries",
				"let":  bson.M{"playerScore": fmt.Sprintf("$%s", sortField)},
				"pipeline": []bson.M{
					{
						"$match": bson.M{
							"$expr": bson.M{
								"$cond": bson.M{
									"if": bson.M{"$eq": []interface{}{sortOrder, 1}},
									"then": bson.M{"$lt": []interface{}{fmt.Sprintf("$%s", sortField), "$$playerScore"}},
									"else": bson.M{"$gt": []interface{}{fmt.Sprintf("$%s", sortField), "$$playerScore"}},
								},
							},
						},
					},
				},
				"as": "betterEntries",
			},
		},
		{
			"$project": bson.M{
				"rank": bson.M{"$add": []interface{}{bson.M{"$size": "$betterEntries"}, 1}},
			},
		},
	}
	
	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, fmt.Errorf("failed to get player rank: %w", err)
	}
	defer cursor.Close(ctx)
	
	var result []bson.M
	if err := cursor.All(ctx, &result); err != nil {
		return 0, fmt.Errorf("failed to decode player rank: %w", err)
	}
	
	if len(result) == 0 {
		return 0, fmt.Errorf("player not found in leaderboard")
	}
	
	return int(result[0]["rank"].(int32)), nil
}

// Helper methods

func (r *LeaderboardRepositoryImpl) buildMongoFilter(filter models.LeaderboardFilter) bson.M {
	mongoFilter := bson.M{}
	
	if filter.GameMode != nil {
		mongoFilter["gameMode"] = *filter.GameMode
	}
	
	if filter.Theme != nil {
		mongoFilter["theme"] = *filter.Theme
	}
	
	if filter.TimeRange != nil {
		var timeFilter time.Time
		now := time.Now()
		
		switch *filter.TimeRange {
		case "day":
			timeFilter = now.AddDate(0, 0, -1)
		case "week":
			timeFilter = now.AddDate(0, 0, -7)
		case "month":
			timeFilter = now.AddDate(0, -1, 0)
		default:
			// "all" or invalid - no time filter
		}
		
		if !timeFilter.IsZero() {
			mongoFilter["completedAt"] = bson.M{"$gte": timeFilter}
		}
	}
	
	return mongoFilter
}

func (r *LeaderboardRepositoryImpl) updateRedisLeaderboards(ctx context.Context, entry *models.LeaderboardEntry) error {
	// Update fastest completions leaderboard
	if err := r.redis.AddToLeaderboard(ctx, "fastest_completions", entry.PlayerID, float64(entry.CompletionTime.Nanoseconds())); err != nil {
		return err
	}
	
	// Update highest averages leaderboard
	if err := r.redis.AddToLeaderboard(ctx, "highest_averages", entry.PlayerID, entry.AverageScore); err != nil {
		return err
	}
	
	// Update most completed leaderboard
	if err := r.redis.AddToLeaderboard(ctx, "most_completed", entry.PlayerID, float64(entry.DoorsCompleted)); err != nil {
		return err
	}
	
	return nil
}

func (r *LeaderboardRepositoryImpl) getCachedLeaderboard(ctx context.Context, category string, filter models.LeaderboardFilter) ([]models.LeaderboardEntry, error) {
	// Implementation would deserialize cached leaderboard data
	// For now, return empty to force MongoDB query
	return nil, fmt.Errorf("cache miss")
}

func (r *LeaderboardRepositoryImpl) cacheLeaderboard(ctx context.Context, category string, filter models.LeaderboardFilter, entries []models.LeaderboardEntry) error {
	// Implementation would serialize and cache leaderboard data
	// Cache for 5 minutes
	return nil
}

func (r *LeaderboardRepositoryImpl) getCachedStats(ctx context.Context) (*models.LeaderboardStats, error) {
	// Implementation would deserialize cached stats
	return nil, fmt.Errorf("cache miss")
}

func (r *LeaderboardRepositoryImpl) cacheStats(ctx context.Context, stats *models.LeaderboardStats) error {
	// Implementation would serialize and cache stats
	return nil
}

func (r *LeaderboardRepositoryImpl) getMostActivePlayer(ctx context.Context) (string, error) {
	// Find player with most games completed
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":   "$playerId",
				"count": bson.M{"$sum": 1},
			},
		},
		{
			"$sort": bson.M{"count": -1},
		},
		{
			"$limit": 1,
		},
	}
	
	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return "", err
	}
	defer cursor.Close(ctx)
	
	var result []bson.M
	if err := cursor.All(ctx, &result); err != nil {
		return "", err
	}
	
	if len(result) == 0 {
		return "", fmt.Errorf("no active players found")
	}
	
	return result[0]["_id"].(string), nil
}