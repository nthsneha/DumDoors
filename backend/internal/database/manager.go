package database

import (
	"context"
	"dumdoors-backend/internal/config"
	"fmt"
	"log"
)

// DatabaseManager manages all database connections
type DatabaseManager struct {
	MongoDB *MongoClient
	Neo4j   *Neo4jClient
	Redis   *RedisClient
}

// NewDatabaseManager creates a new database manager with all connections
func NewDatabaseManager(cfg *config.Config) (*DatabaseManager, error) {
	// Initialize MongoDB
	mongodb, err := NewMongoClient(cfg.MongoURI, "dumdoors")
	if err != nil {
		return nil, fmt.Errorf("failed to initialize MongoDB: %w", err)
	}

	// Initialize Neo4j
	neo4j, err := NewNeo4jClient(cfg.Neo4jURI, cfg.Neo4jUser, cfg.Neo4jPass)
	if err != nil {
		mongodb.Close() // Clean up MongoDB connection
		return nil, fmt.Errorf("failed to initialize Neo4j: %w", err)
	}

	// Initialize Redis
	redis, err := NewRedisClient(cfg.RedisURI)
	if err != nil {
		mongodb.Close() // Clean up MongoDB connection
		neo4j.Close(context.Background()) // Clean up Neo4j connection
		return nil, fmt.Errorf("failed to initialize Redis: %w", err)
	}

	manager := &DatabaseManager{
		MongoDB: mongodb,
		Neo4j:   neo4j,
		Redis:   redis,
	}

	// Initialize database schemas and indexes
	if err := manager.InitializeSchemas(); err != nil {
		manager.Close()
		return nil, fmt.Errorf("failed to initialize database schemas: %w", err)
	}

	log.Println("Successfully initialized all database connections")
	return manager, nil
}

// InitializeSchemas creates necessary indexes and constraints for all databases
func (dm *DatabaseManager) InitializeSchemas() error {
	ctx := context.Background()

	// Initialize MongoDB indexes
	if err := dm.MongoDB.CreateIndexes(); err != nil {
		return fmt.Errorf("failed to create MongoDB indexes: %w", err)
	}

	// Initialize Neo4j schema
	if err := dm.Neo4j.InitializeSchema(ctx); err != nil {
		return fmt.Errorf("failed to initialize Neo4j schema: %w", err)
	}

	// Create initial door relationships in Neo4j
	if err := dm.Neo4j.CreateDoorRelationships(ctx); err != nil {
		return fmt.Errorf("failed to create door relationships: %w", err)
	}

	return nil
}

// Close closes all database connections
func (dm *DatabaseManager) Close() {
	ctx := context.Background()

	if dm.MongoDB != nil {
		if err := dm.MongoDB.Close(); err != nil {
			log.Printf("Error closing MongoDB connection: %v", err)
		}
	}

	if dm.Neo4j != nil {
		if err := dm.Neo4j.Close(ctx); err != nil {
			log.Printf("Error closing Neo4j connection: %v", err)
		}
	}

	if dm.Redis != nil {
		if err := dm.Redis.Close(); err != nil {
			log.Printf("Error closing Redis connection: %v", err)
		}
	}

	log.Println("All database connections closed")
}

// HealthCheck performs health checks on all database connections
func (dm *DatabaseManager) HealthCheck(ctx context.Context) error {
	// Check MongoDB
	if err := dm.MongoDB.Client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("MongoDB health check failed: %w", err)
	}

	// Check Neo4j
	if err := dm.Neo4j.Driver.VerifyConnectivity(ctx); err != nil {
		return fmt.Errorf("Neo4j health check failed: %w", err)
	}

	// Check Redis
	if err := dm.Redis.Client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("Redis health check failed: %w", err)
	}

	return nil
}