package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"dumdoors-backend/internal/config"
	"dumdoors-backend/internal/database"
	"dumdoors-backend/internal/handlers"
	"dumdoors-backend/internal/repositories"
	"dumdoors-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize database manager
	dbManager, err := database.NewDatabaseManager(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database manager: %v", err)
	}
	defer dbManager.Close()

	// Initialize repositories
	gameSessionRepo := repositories.NewGameSessionRepository(dbManager.MongoDB, dbManager.Redis)
	doorRepo := repositories.NewDoorRepository(dbManager.MongoDB, dbManager.Redis)
	playerPathRepo := repositories.NewPlayerPathRepository(dbManager.Neo4j)

	// Initialize services
	gameService := services.NewGameService()
	devvitService := services.NewDevvitIntegration()

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler()
	gameHandler := handlers.NewGameHandler()
	devvitHandler := handlers.NewDevvitHandler(devvitService)

	// Suppress unused variable warnings for repositories that will be used in later tasks
	_ = gameSessionRepo
	_ = doorRepo
	_ = playerPathRepo

	// Create Fiber app with configuration
	app := fiber.New(fiber.Config{
		AppName:      "DumDoors Backend v1.0",
		ErrorHandler: customErrorHandler,
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} - ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: false,
	}))

	// Health check endpoint
	app.Get("/health", healthHandler.CheckHealth)
	
	// Database health check endpoint
	app.Get("/health/db", func(c *fiber.Ctx) error {
		ctx := context.Background()
		if err := dbManager.HealthCheck(ctx); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status": "unhealthy",
				"error":  err.Error(),
			})
		}
		return c.JSON(fiber.Map{
			"status":    "healthy",
			"databases": []string{"mongodb", "neo4j", "redis"},
		})
	})

	// API routes
	api := app.Group("/api")
	api.Get("/", gameHandler.GetAPIInfo)
	
	// Devvit integration routes (migrated from Express server)
	api.Get("/init", devvitHandler.InitGame)

	// Game routes (placeholders for future implementation)
	game := api.Group("/game")
	_ = game // Suppress unused variable warning for now

	// WebSocket routes (placeholder for future implementation)
	ws := api.Group("/ws")
	_ = ws // Suppress unused variable warning for now

	// Internal Devvit routes
	internal := app.Group("/internal")
	internal.Post("/on-app-install", devvitHandler.OnAppInstall)
	internal.Post("/menu/post-create", devvitHandler.MenuPostCreate)

	// Suppress unused variable warnings for services that will be used in later tasks
	_ = gameService

	log.Printf("Starting DumDoors backend on port %s", cfg.Port)
	log.Printf("Configuration loaded: MongoDB=%s, Neo4j=%s, Redis=%s, AI Service=%s", 
		cfg.MongoURI, cfg.Neo4jURI, cfg.RedisURI, cfg.AIServiceURL)
	
	// Start server in a goroutine
	go func() {
		if err := app.Listen(":" + cfg.Port); err != nil {
			log.Printf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	log.Println("Shutting down server...")
	
	// Shutdown server
	if err := app.Shutdown(); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
	
	log.Println("Server shutdown complete")
}

// customErrorHandler handles application errors
func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Internal Server Error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message
	}

	log.Printf("Error: %v", err)

	return c.Status(code).JSON(fiber.Map{
		"error":   true,
		"message": message,
		"code":    code,
	})
}