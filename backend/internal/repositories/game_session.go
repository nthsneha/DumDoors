package repositories

import (
	"context"
	"dumdoors-backend/internal/database"
	"dumdoors-backend/internal/models"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// GameSessionRepository interface defines operations for game sessions
type GameSessionRepository interface {
	Create(ctx context.Context, session *models.GameSession) error
	GetByID(ctx context.Context, sessionID string) (*models.GameSession, error)
	Update(ctx context.Context, session *models.GameSession) error
	Delete(ctx context.Context, sessionID string) error
	GetActiveSessionsByStatus(ctx context.Context, status models.GameStatus) ([]*models.GameSession, error)
	AddPlayerToSession(ctx context.Context, sessionID string, player models.PlayerInfo) error
	UpdatePlayerInSession(ctx context.Context, sessionID string, player models.PlayerInfo) error
}

// GameSessionRepositoryImpl implements the GameSessionRepository interface
type GameSessionRepositoryImpl struct {
	collection *mongo.Collection
	redis      *database.RedisClient
}

// NewGameSessionRepository creates a new game session repository
func NewGameSessionRepository(mongodb *database.MongoClient, redis *database.RedisClient) GameSessionRepository {
	return &GameSessionRepositoryImpl{
		collection: mongodb.GetCollection("game_sessions"),
		redis:      redis,
	}
}

// Create creates a new game session
func (r *GameSessionRepositoryImpl) Create(ctx context.Context, session *models.GameSession) error {
	session.CreatedAt = time.Now()
	
	result, err := r.collection.InsertOne(ctx, session)
	if err != nil {
		return fmt.Errorf("failed to create game session: %w", err)
	}
	
	session.ID = result.InsertedID.(primitive.ObjectID)
	
	// Cache session in Redis for quick access
	if err := r.cacheSession(ctx, session); err != nil {
		// Log error but don't fail the operation
		fmt.Printf("Warning: failed to cache session in Redis: %v\n", err)
	}
	
	return nil
}

// GetByID retrieves a game session by ID
func (r *GameSessionRepositoryImpl) GetByID(ctx context.Context, sessionID string) (*models.GameSession, error) {
	// Try to get from Redis cache first
	if session, err := r.getCachedSession(ctx, sessionID); err == nil && session != nil {
		return session, nil
	}
	
	// If not in cache, get from MongoDB
	var session models.GameSession
	filter := bson.M{"sessionId": sessionID}
	
	err := r.collection.FindOne(ctx, filter).Decode(&session)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get game session: %w", err)
	}
	
	// Cache the session for future requests
	if err := r.cacheSession(ctx, &session); err != nil {
		fmt.Printf("Warning: failed to cache session in Redis: %v\n", err)
	}
	
	return &session, nil
}

// Update updates an existing game session
func (r *GameSessionRepositoryImpl) Update(ctx context.Context, session *models.GameSession) error {
	filter := bson.M{"sessionId": session.SessionID}
	update := bson.M{"$set": session}
	
	_, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update game session: %w", err)
	}
	
	// Update cache
	if err := r.cacheSession(ctx, session); err != nil {
		fmt.Printf("Warning: failed to update session cache: %v\n", err)
	}
	
	return nil
}

// Delete deletes a game session
func (r *GameSessionRepositoryImpl) Delete(ctx context.Context, sessionID string) error {
	filter := bson.M{"sessionId": sessionID}
	
	_, err := r.collection.DeleteOne(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to delete game session: %w", err)
	}
	
	// Remove from cache
	if err := r.redis.DeleteGameSession(ctx, sessionID); err != nil {
		fmt.Printf("Warning: failed to remove session from cache: %v\n", err)
	}
	
	return nil
}

// GetActiveSessionsByStatus retrieves active sessions by status
func (r *GameSessionRepositoryImpl) GetActiveSessionsByStatus(ctx context.Context, status models.GameStatus) ([]*models.GameSession, error) {
	filter := bson.M{"status": status}
	
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find sessions by status: %w", err)
	}
	defer cursor.Close(ctx)
	
	var sessions []*models.GameSession
	for cursor.Next(ctx) {
		var session models.GameSession
		if err := cursor.Decode(&session); err != nil {
			return nil, fmt.Errorf("failed to decode session: %w", err)
		}
		sessions = append(sessions, &session)
	}
	
	return sessions, nil
}

// AddPlayerToSession adds a player to an existing session
func (r *GameSessionRepositoryImpl) AddPlayerToSession(ctx context.Context, sessionID string, player models.PlayerInfo) error {
	filter := bson.M{"sessionId": sessionID}
	update := bson.M{"$push": bson.M{"players": player}}
	
	_, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to add player to session: %w", err)
	}
	
	// Invalidate cache to force refresh
	if err := r.redis.DeleteGameSession(ctx, sessionID); err != nil {
		fmt.Printf("Warning: failed to invalidate session cache: %v\n", err)
	}
	
	return nil
}

// UpdatePlayerInSession updates a player's information in a session
func (r *GameSessionRepositoryImpl) UpdatePlayerInSession(ctx context.Context, sessionID string, player models.PlayerInfo) error {
	filter := bson.M{
		"sessionId":       sessionID,
		"players.playerId": player.PlayerID,
	}
	update := bson.M{"$set": bson.M{"players.$": player}}
	
	_, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update player in session: %w", err)
	}
	
	// Invalidate cache to force refresh
	if err := r.redis.DeleteGameSession(ctx, sessionID); err != nil {
		fmt.Printf("Warning: failed to invalidate session cache: %v\n", err)
	}
	
	return nil
}

// Helper methods for Redis caching
func (r *GameSessionRepositoryImpl) cacheSession(ctx context.Context, session *models.GameSession) error {
	// Cache for 1 hour
	return r.redis.SetGameSession(ctx, session.SessionID, session, time.Hour)
}

func (r *GameSessionRepositoryImpl) getCachedSession(ctx context.Context, sessionID string) (*models.GameSession, error) {
	data, err := r.redis.GetGameSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	
	// In a real implementation, you would unmarshal the JSON data
	// For now, return nil to indicate cache miss
	_ = data
	return nil, fmt.Errorf("cache implementation pending")
}