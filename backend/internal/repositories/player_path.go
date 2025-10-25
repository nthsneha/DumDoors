package repositories

import (
	"context"
	"dumdoors-backend/internal/database"
	"dumdoors-backend/internal/models"
	"fmt"
	"time"
)

// PlayerPathRepository interface defines operations for player paths in Neo4j
type PlayerPathRepository interface {
	CreatePlayer(ctx context.Context, playerID, username string) error
	GetNextDoor(ctx context.Context, playerID string, currentScore int) (string, error)
	UpdatePlayerPosition(ctx context.Context, playerID, doorID string) error
	GetPlayerPath(ctx context.Context, playerID string) (*models.PlayerPath, error)
	UpdatePlayerPath(ctx context.Context, playerPath *models.PlayerPath) error
	CalculateOptimalPath(ctx context.Context, playerID string, scores []int) ([]string, error)
}

// PlayerPathRepositoryImpl implements the PlayerPathRepository interface
type PlayerPathRepositoryImpl struct {
	neo4j *database.Neo4jClient
}

// NewPlayerPathRepository creates a new player path repository
func NewPlayerPathRepository(neo4j *database.Neo4jClient) PlayerPathRepository {
	return &PlayerPathRepositoryImpl{
		neo4j: neo4j,
	}
}

// CreatePlayer creates a new player node in Neo4j
func (r *PlayerPathRepositoryImpl) CreatePlayer(ctx context.Context, playerID, username string) error {
	query := `
		MERGE (p:Player {id: $playerId})
		SET p.username = $username, p.currentPosition = 0, p.createdAt = datetime()
		RETURN p
	`
	
	params := map[string]interface{}{
		"playerId": playerID,
		"username": username,
	}
	
	_, err := r.neo4j.ExecuteQuery(ctx, query, params)
	if err != nil {
		return fmt.Errorf("failed to create player: %w", err)
	}
	
	return nil
}

// GetNextDoor determines the next door for a player based on their current score
func (r *PlayerPathRepositoryImpl) GetNextDoor(ctx context.Context, playerID string, currentScore int) (string, error) {
	query := `
		MATCH (p:Player {id: $playerId})-[:CURRENTLY_AT]->(current:Door)
		MATCH (current)-[r:LEADS_TO]->(next:Door)
		WHERE $score >= r.scoreThreshold
		RETURN next.id as doorId
		ORDER BY r.scoreThreshold DESC
		LIMIT 1
	`
	
	params := map[string]interface{}{
		"playerId": playerID,
		"score":    currentScore,
	}
	
	result, err := r.neo4j.ExecuteQuery(ctx, query, params)
	if err != nil {
		return "", fmt.Errorf("failed to get next door: %w", err)
	}
	
	if len(result.Records) == 0 {
		// If no next door found, try to get a default path
		return r.getDefaultNextDoor(ctx, playerID)
	}
	
	doorID, _ := result.Records[0].Get("doorId")
	return doorID.(string), nil
}

// UpdatePlayerPosition updates the player's current position in the graph
func (r *PlayerPathRepositoryImpl) UpdatePlayerPosition(ctx context.Context, playerID, doorID string) error {
	query := `
		MATCH (p:Player {id: $playerId})
		OPTIONAL MATCH (p)-[r:CURRENTLY_AT]->()
		DELETE r
		WITH p
		MATCH (door:Door {id: $doorId})
		CREATE (p)-[:CURRENTLY_AT]->(door)
		SET p.currentPosition = p.currentPosition + 1
		RETURN p
	`
	
	params := map[string]interface{}{
		"playerId": playerID,
		"doorId":   doorID,
	}
	
	_, err := r.neo4j.ExecuteQuery(ctx, query, params)
	if err != nil {
		return fmt.Errorf("failed to update player position: %w", err)
	}
	
	return nil
}

// GetPlayerPath retrieves the complete path information for a player
func (r *PlayerPathRepositoryImpl) GetPlayerPath(ctx context.Context, playerID string) (*models.PlayerPath, error) {
	// Get player information and visited doors
	query := `
		MATCH (p:Player {id: $playerId})
		OPTIONAL MATCH (p)-[:VISITED]->(door:Door)
		RETURN p.currentPosition as currentPosition, 
		       collect(door.id) as doorsVisited,
		       p.createdAt as createdAt
		ORDER BY door.createdAt
	`
	
	params := map[string]interface{}{
		"playerId": playerID,
	}
	
	result, err := r.neo4j.ExecuteQuery(ctx, query, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get player path: %w", err)
	}
	
	if len(result.Records) == 0 {
		// Return a default path if player not found
		return &models.PlayerPath{
			PlayerID:          playerID,
			Theme:             "general",
			CurrentDifficulty: 1,
			DoorsVisited:      []string{},
			CurrentPosition:   0,
			TotalDoors:        10, // Default total doors
			CreatedAt:         time.Now(),
		}, nil
	}
	
	record := result.Records[0]
	currentPosition, _ := record.Get("currentPosition")
	doorsVisited, _ := record.Get("doorsVisited")
	createdAt, _ := record.Get("createdAt")
	
	// Convert doors visited to string slice
	var doors []string
	if doorsVisited != nil {
		if doorList, ok := doorsVisited.([]interface{}); ok {
			for _, door := range doorList {
				if doorStr, ok := door.(string); ok {
					doors = append(doors, doorStr)
				}
			}
		}
	}
	
	// Determine current difficulty based on position
	difficulty := 1
	if len(doors) > 3 {
		difficulty = 2
	}
	if len(doors) > 6 {
		difficulty = 3
	}
	
	playerPath := &models.PlayerPath{
		PlayerID:          playerID,
		Theme:             "general", // Default theme, could be enhanced to track actual theme
		CurrentDifficulty: difficulty,
		DoorsVisited:      doors,
		CurrentPosition:   currentPosition.(int),
		TotalDoors:        10, // Default, could be calculated based on path type
		CreatedAt:         createdAt.(time.Time),
	}
	
	return playerPath, nil
}

// UpdatePlayerPath updates the player's path information in Neo4j
func (r *PlayerPathRepositoryImpl) UpdatePlayerPath(ctx context.Context, playerPath *models.PlayerPath) error {
	// Update player node with path information
	query := `
		MERGE (p:Player {id: $playerId})
		SET p.currentPosition = $currentPosition,
		    p.totalDoors = $totalDoors,
		    p.currentDifficulty = $currentDifficulty,
		    p.theme = $theme
		WITH p
		// Mark doors as visited
		UNWIND $doorsVisited as doorId
		MERGE (door:Door {id: doorId})
		MERGE (p)-[:VISITED]->(door)
		RETURN p
	`
	
	params := map[string]interface{}{
		"playerId":          playerPath.PlayerID,
		"currentPosition":   playerPath.CurrentPosition,
		"totalDoors":        playerPath.TotalDoors,
		"currentDifficulty": playerPath.CurrentDifficulty,
		"theme":             playerPath.Theme,
		"doorsVisited":      playerPath.DoorsVisited,
	}
	
	_, err := r.neo4j.ExecuteQuery(ctx, query, params)
	if err != nil {
		return fmt.Errorf("failed to update player path: %w", err)
	}
	
	return nil
}

// CalculateOptimalPath calculates the optimal path for a player based on their scores
func (r *PlayerPathRepositoryImpl) CalculateOptimalPath(ctx context.Context, playerID string, scores []int) ([]string, error) {
	// Calculate average score to determine path difficulty
	totalScore := 0
	for _, score := range scores {
		totalScore += score
	}
	avgScore := float64(totalScore) / float64(len(scores))
	
	var pathType string
	if avgScore >= 70 {
		pathType = "short"
	} else {
		pathType = "long"
	}
	
	query := `
		MATCH (path:Path {id: $pathType})-[:CONTAINS]->(door:Door)
		RETURN door.id as doorId
		ORDER BY door.difficulty
	`
	
	params := map[string]interface{}{
		"pathType": pathType,
	}
	
	result, err := r.neo4j.ExecuteQuery(ctx, query, params)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate optimal path: %w", err)
	}
	
	var path []string
	for _, record := range result.Records {
		doorID, _ := record.Get("doorId")
		path = append(path, doorID.(string))
	}
	
	return path, nil
}

// getDefaultNextDoor gets a default next door when no score-based path is found
func (r *PlayerPathRepositoryImpl) getDefaultNextDoor(ctx context.Context, playerID string) (string, error) {
	query := `
		MATCH (p:Player {id: $playerId})
		MATCH (door:Door)
		WHERE NOT (p)-[:VISITED]->(door)
		RETURN door.id as doorId
		ORDER BY door.difficulty
		LIMIT 1
	`
	
	params := map[string]interface{}{
		"playerId": playerID,
	}
	
	result, err := r.neo4j.ExecuteQuery(ctx, query, params)
	if err != nil {
		return "", fmt.Errorf("failed to get default next door: %w", err)
	}
	
	if len(result.Records) == 0 {
		return "end", nil // Return end door if no more doors available
	}
	
	doorID, _ := result.Records[0].Get("doorId")
	return doorID.(string), nil
}