package database

import (
	"context"
	"fmt"
	"log"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Neo4jClient wraps the Neo4j driver with additional functionality
type Neo4jClient struct {
	Driver neo4j.DriverWithContext
}

// NewNeo4jClient creates a new Neo4j client connection
func NewNeo4jClient(uri, username, password string) (*Neo4jClient, error) {
	// Create driver
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(username, password, ""))
	if err != nil {
		return nil, fmt.Errorf("failed to create Neo4j driver: %w", err)
	}

	// Verify connectivity
	ctx := context.Background()
	if err := driver.VerifyConnectivity(ctx); err != nil {
		return nil, fmt.Errorf("failed to verify Neo4j connectivity: %w", err)
	}

	log.Printf("Successfully connected to Neo4j at: %s", uri)
	
	return &Neo4jClient{
		Driver: driver,
	}, nil
}

// Close closes the Neo4j connection
func (nc *Neo4jClient) Close(ctx context.Context) error {
	return nc.Driver.Close(ctx)
}

// ExecuteQuery executes a Cypher query and returns the result
func (nc *Neo4jClient) ExecuteQuery(ctx context.Context, query string, params map[string]interface{}) (*neo4j.EagerResult, error) {
	return neo4j.ExecuteQuery(ctx, nc.Driver, query, params, neo4j.EagerResultTransformer)
}

// CreateSession creates a new Neo4j session
func (nc *Neo4jClient) CreateSession(ctx context.Context) neo4j.SessionWithContext {
	return nc.Driver.NewSession(ctx, neo4j.SessionConfig{})
}

// InitializeSchema creates the necessary constraints and indexes for the graph database
func (nc *Neo4jClient) InitializeSchema(ctx context.Context) error {
	session := nc.CreateSession(ctx)
	defer session.Close(ctx)

	// Create constraints
	constraints := []string{
		"CREATE CONSTRAINT door_id_unique IF NOT EXISTS FOR (d:Door) REQUIRE d.id IS UNIQUE",
		"CREATE CONSTRAINT player_id_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE",
		"CREATE CONSTRAINT path_id_unique IF NOT EXISTS FOR (path:Path) REQUIRE path.id IS UNIQUE",
	}

	for _, constraint := range constraints {
		_, err := session.Run(ctx, constraint, nil)
		if err != nil {
			return fmt.Errorf("failed to create constraint: %w", err)
		}
	}

	// Create indexes
	indexes := []string{
		"CREATE INDEX door_theme_index IF NOT EXISTS FOR (d:Door) ON (d.theme)",
		"CREATE INDEX door_difficulty_index IF NOT EXISTS FOR (d:Door) ON (d.difficulty)",
		"CREATE INDEX player_username_index IF NOT EXISTS FOR (p:Player) ON (p.username)",
	}

	for _, index := range indexes {
		_, err := session.Run(ctx, index, nil)
		if err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	log.Println("Successfully initialized Neo4j schema")
	return nil
}

// CreateDoorRelationships creates the basic door relationship structure
func (nc *Neo4jClient) CreateDoorRelationships(ctx context.Context) error {
	session := nc.CreateSession(ctx)
	defer session.Close(ctx)

	// Create sample door nodes and relationships for testing
	query := `
		// Create sample doors if they don't exist
		MERGE (start:Door {id: 'start', content: 'Welcome to DumDoors! Choose your first challenge.', theme: 'intro', difficulty: 1})
		MERGE (easy1:Door {id: 'easy1', content: 'You find a locked door with a riddle.', theme: 'puzzle', difficulty: 2})
		MERGE (hard1:Door {id: 'hard1', content: 'You encounter a complex mechanical puzzle.', theme: 'puzzle', difficulty: 4})
		MERGE (end:Door {id: 'end', content: 'Congratulations! You have completed the challenge.', theme: 'victory', difficulty: 1})
		
		// Create relationships based on score thresholds
		MERGE (start)-[:LEADS_TO {scoreThreshold: 70}]->(easy1)
		MERGE (start)-[:LEADS_TO {scoreThreshold: 30}]->(hard1)
		MERGE (easy1)-[:LEADS_TO {scoreThreshold: 50}]->(end)
		MERGE (hard1)-[:LEADS_TO {scoreThreshold: 60}]->(end)
		
		// Create paths
		MERGE (shortPath:Path {id: 'short', totalDoors: 2, difficulty: 'easy'})
		MERGE (longPath:Path {id: 'long', totalDoors: 3, difficulty: 'hard'})
		
		// Connect paths to doors
		MERGE (shortPath)-[:CONTAINS]->(start)
		MERGE (shortPath)-[:CONTAINS]->(easy1)
		MERGE (shortPath)-[:CONTAINS]->(end)
		
		MERGE (longPath)-[:CONTAINS]->(start)
		MERGE (longPath)-[:CONTAINS]->(hard1)
		MERGE (longPath)-[:CONTAINS]->(end)
	`

	_, err := session.Run(ctx, query, nil)
	if err != nil {
		return fmt.Errorf("failed to create door relationships: %w", err)
	}

	log.Println("Successfully created door relationships in Neo4j")
	return nil
}