package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoClient wraps the MongoDB client with additional functionality
type MongoClient struct {
	Client   *mongo.Client
	Database *mongo.Database
}

// NewMongoClient creates a new MongoDB client connection
func NewMongoClient(uri, dbName string) (*MongoClient, error) {
	// Set client options
	clientOptions := options.Client().ApplyURI(uri)
	
	// Set connection timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Connect to MongoDB
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping the database to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	database := client.Database(dbName)
	
	log.Printf("Successfully connected to MongoDB database: %s", dbName)
	
	return &MongoClient{
		Client:   client,
		Database: database,
	}, nil
}

// Close closes the MongoDB connection
func (mc *MongoClient) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	return mc.Client.Disconnect(ctx)
}

// GetCollection returns a MongoDB collection
func (mc *MongoClient) GetCollection(name string) *mongo.Collection {
	return mc.Database.Collection(name)
}

// CreateIndexes creates necessary indexes for the collections
func (mc *MongoClient) CreateIndexes() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Game sessions collection indexes
	sessionsCollection := mc.GetCollection("game_sessions")
	sessionIndexes := []mongo.IndexModel{
		{
			Keys: map[string]int{"sessionId": 1},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: map[string]int{"status": 1},
		},
		{
			Keys: map[string]int{"createdAt": 1},
		},
	}
	
	if _, err := sessionsCollection.Indexes().CreateMany(ctx, sessionIndexes); err != nil {
		return fmt.Errorf("failed to create session indexes: %w", err)
	}

	// Doors collection indexes
	doorsCollection := mc.GetCollection("doors")
	doorIndexes := []mongo.IndexModel{
		{
			Keys: map[string]int{"doorId": 1},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: map[string]int{"theme": 1},
		},
		{
			Keys: map[string]int{"difficulty": 1},
		},
	}
	
	if _, err := doorsCollection.Indexes().CreateMany(ctx, doorIndexes); err != nil {
		return fmt.Errorf("failed to create door indexes: %w", err)
	}

	// Player responses collection indexes
	responsesCollection := mc.GetCollection("player_responses")
	responseIndexes := []mongo.IndexModel{
		{
			Keys: map[string]int{"responseId": 1},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: map[string]int{"playerId": 1},
		},
		{
			Keys: map[string]int{"doorId": 1},
		},
		{
			Keys: map[string]int{"submittedAt": 1},
		},
	}
	
	if _, err := responsesCollection.Indexes().CreateMany(ctx, responseIndexes); err != nil {
		return fmt.Errorf("failed to create response indexes: %w", err)
	}

	log.Println("Successfully created MongoDB indexes")
	return nil
}