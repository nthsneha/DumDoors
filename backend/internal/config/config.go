package config

import (
	"os"
)

// Config holds all configuration for the application
type Config struct {
	Port        string
	MongoURI    string
	Neo4jURI    string
	Neo4jUser   string
	Neo4jPass   string
	RedisURI    string
	AIServiceURL string
	Environment string
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		MongoURI:     getEnv("MONGO_URI", "mongodb://localhost:27017"),
		Neo4jURI:     getEnv("NEO4J_URI", "bolt://localhost:7687"),
		Neo4jUser:    getEnv("NEO4J_USER", "neo4j"),
		Neo4jPass:    getEnv("NEO4J_PASS", "password"),
		RedisURI:     getEnv("REDIS_URI", "redis://localhost:6379"),
		AIServiceURL: getEnv("AI_SERVICE_URL", "http://localhost:8000"),
		Environment:  getEnv("ENVIRONMENT", "development"),
	}
}

// getEnv gets an environment variable with a fallback value
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}