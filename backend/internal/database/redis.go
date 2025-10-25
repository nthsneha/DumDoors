package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient wraps the Redis client with additional functionality
type RedisClient struct {
	Client *redis.Client
}

// NewRedisClient creates a new Redis client connection
func NewRedisClient(uri string) (*RedisClient, error) {
	// Parse Redis URI
	opt, err := redis.ParseURL(uri)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URI: %w", err)
	}

	// Create Redis client
	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("Successfully connected to Redis at: %s", opt.Addr)
	
	return &RedisClient{
		Client: client,
	}, nil
}

// Close closes the Redis connection
func (rc *RedisClient) Close() error {
	return rc.Client.Close()
}

// SetGameSession stores a game session in Redis with expiration
func (rc *RedisClient) SetGameSession(ctx context.Context, sessionID string, data interface{}, expiration time.Duration) error {
	key := fmt.Sprintf("session:%s", sessionID)
	return rc.Client.Set(ctx, key, data, expiration).Err()
}

// GetGameSession retrieves a game session from Redis
func (rc *RedisClient) GetGameSession(ctx context.Context, sessionID string) (string, error) {
	key := fmt.Sprintf("session:%s", sessionID)
	return rc.Client.Get(ctx, key).Result()
}

// DeleteGameSession removes a game session from Redis
func (rc *RedisClient) DeleteGameSession(ctx context.Context, sessionID string) error {
	key := fmt.Sprintf("session:%s", sessionID)
	return rc.Client.Del(ctx, key).Err()
}

// SetPlayerState stores player state in Redis
func (rc *RedisClient) SetPlayerState(ctx context.Context, playerID string, data interface{}, expiration time.Duration) error {
	key := fmt.Sprintf("player:%s", playerID)
	return rc.Client.Set(ctx, key, data, expiration).Err()
}

// GetPlayerState retrieves player state from Redis
func (rc *RedisClient) GetPlayerState(ctx context.Context, playerID string) (string, error) {
	key := fmt.Sprintf("player:%s", playerID)
	return rc.Client.Get(ctx, key).Result()
}

// CacheDoor stores a door in Redis cache
func (rc *RedisClient) CacheDoor(ctx context.Context, doorID string, data interface{}, expiration time.Duration) error {
	key := fmt.Sprintf("door:%s", doorID)
	return rc.Client.Set(ctx, key, data, expiration).Err()
}

// GetCachedDoor retrieves a cached door from Redis
func (rc *RedisClient) GetCachedDoor(ctx context.Context, doorID string) (string, error) {
	key := fmt.Sprintf("door:%s", doorID)
	return rc.Client.Get(ctx, key).Result()
}

// AddToLeaderboard adds a player score to the leaderboard
func (rc *RedisClient) AddToLeaderboard(ctx context.Context, leaderboardName string, playerID string, score float64) error {
	key := fmt.Sprintf("leaderboard:%s", leaderboardName)
	return rc.Client.ZAdd(ctx, key, redis.Z{
		Score:  score,
		Member: playerID,
	}).Err()
}

// GetLeaderboard retrieves the top players from a leaderboard
func (rc *RedisClient) GetLeaderboard(ctx context.Context, leaderboardName string, limit int64) ([]redis.Z, error) {
	key := fmt.Sprintf("leaderboard:%s", leaderboardName)
	return rc.Client.ZRevRangeWithScores(ctx, key, 0, limit-1).Result()
}

// SetWithExpiration sets a key-value pair with expiration
func (rc *RedisClient) SetWithExpiration(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return rc.Client.Set(ctx, key, value, expiration).Err()
}

// Get retrieves a value by key
func (rc *RedisClient) Get(ctx context.Context, key string) (string, error) {
	return rc.Client.Get(ctx, key).Result()
}

// Delete removes a key
func (rc *RedisClient) Delete(ctx context.Context, key string) error {
	return rc.Client.Del(ctx, key).Err()
}

// Exists checks if a key exists
func (rc *RedisClient) Exists(ctx context.Context, key string) (bool, error) {
	result, err := rc.Client.Exists(ctx, key).Result()
	return result > 0, err
}