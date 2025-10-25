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

// DoorRepository interface defines operations for doors
type DoorRepository interface {
	Create(ctx context.Context, door *models.Door) error
	GetByID(ctx context.Context, doorID string) (*models.Door, error)
	GetByTheme(ctx context.Context, theme string) ([]*models.Door, error)
	GetByDifficulty(ctx context.Context, difficulty int) ([]*models.Door, error)
	Update(ctx context.Context, door *models.Door) error
	Delete(ctx context.Context, doorID string) error
}

// DoorRepositoryImpl implements the DoorRepository interface
type DoorRepositoryImpl struct {
	collection *mongo.Collection
	redis      *database.RedisClient
}

// NewDoorRepository creates a new door repository
func NewDoorRepository(mongodb *database.MongoClient, redis *database.RedisClient) DoorRepository {
	return &DoorRepositoryImpl{
		collection: mongodb.GetCollection("doors"),
		redis:      redis,
	}
}

// Create creates a new door
func (r *DoorRepositoryImpl) Create(ctx context.Context, door *models.Door) error {
	door.CreatedAt = time.Now()
	
	result, err := r.collection.InsertOne(ctx, door)
	if err != nil {
		return fmt.Errorf("failed to create door: %w", err)
	}
	
	door.ID = result.InsertedID.(primitive.ObjectID)
	
	// Cache door in Redis
	if err := r.cacheDoor(ctx, door); err != nil {
		fmt.Printf("Warning: failed to cache door in Redis: %v\n", err)
	}
	
	return nil
}

// GetByID retrieves a door by ID
func (r *DoorRepositoryImpl) GetByID(ctx context.Context, doorID string) (*models.Door, error) {
	// Try to get from Redis cache first
	if door, err := r.getCachedDoor(ctx, doorID); err == nil && door != nil {
		return door, nil
	}
	
	// If not in cache, get from MongoDB
	var door models.Door
	filter := bson.M{"doorId": doorID}
	
	err := r.collection.FindOne(ctx, filter).Decode(&door)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get door: %w", err)
	}
	
	// Cache the door for future requests
	if err := r.cacheDoor(ctx, &door); err != nil {
		fmt.Printf("Warning: failed to cache door in Redis: %v\n", err)
	}
	
	return &door, nil
}

// GetByTheme retrieves doors by theme
func (r *DoorRepositoryImpl) GetByTheme(ctx context.Context, theme string) ([]*models.Door, error) {
	filter := bson.M{"theme": theme}
	
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find doors by theme: %w", err)
	}
	defer cursor.Close(ctx)
	
	var doors []*models.Door
	for cursor.Next(ctx) {
		var door models.Door
		if err := cursor.Decode(&door); err != nil {
			return nil, fmt.Errorf("failed to decode door: %w", err)
		}
		doors = append(doors, &door)
	}
	
	return doors, nil
}

// GetByDifficulty retrieves doors by difficulty level
func (r *DoorRepositoryImpl) GetByDifficulty(ctx context.Context, difficulty int) ([]*models.Door, error) {
	filter := bson.M{"difficulty": difficulty}
	
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find doors by difficulty: %w", err)
	}
	defer cursor.Close(ctx)
	
	var doors []*models.Door
	for cursor.Next(ctx) {
		var door models.Door
		if err := cursor.Decode(&door); err != nil {
			return nil, fmt.Errorf("failed to decode door: %w", err)
		}
		doors = append(doors, &door)
	}
	
	return doors, nil
}

// Update updates an existing door
func (r *DoorRepositoryImpl) Update(ctx context.Context, door *models.Door) error {
	filter := bson.M{"doorId": door.DoorID}
	update := bson.M{"$set": door}
	
	_, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update door: %w", err)
	}
	
	// Update cache
	if err := r.cacheDoor(ctx, door); err != nil {
		fmt.Printf("Warning: failed to update door cache: %v\n", err)
	}
	
	return nil
}

// Delete deletes a door
func (r *DoorRepositoryImpl) Delete(ctx context.Context, doorID string) error {
	filter := bson.M{"doorId": doorID}
	
	_, err := r.collection.DeleteOne(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to delete door: %w", err)
	}
	
	// Remove from cache
	if err := r.redis.Delete(ctx, fmt.Sprintf("door:%s", doorID)); err != nil {
		fmt.Printf("Warning: failed to remove door from cache: %v\n", err)
	}
	
	return nil
}

// Helper methods for Redis caching
func (r *DoorRepositoryImpl) cacheDoor(ctx context.Context, door *models.Door) error {
	// Cache for 24 hours since doors don't change frequently
	return r.redis.CacheDoor(ctx, door.DoorID, door, 24*time.Hour)
}

func (r *DoorRepositoryImpl) getCachedDoor(ctx context.Context, doorID string) (*models.Door, error) {
	data, err := r.redis.GetCachedDoor(ctx, doorID)
	if err != nil {
		return nil, err
	}
	
	// In a real implementation, you would unmarshal the JSON data
	// For now, return nil to indicate cache miss
	_ = data
	return nil, fmt.Errorf("cache implementation pending")
}