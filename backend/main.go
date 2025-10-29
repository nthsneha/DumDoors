package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"dumdoors-backend/internal/config"
	"dumdoors-backend/internal/database"
	"dumdoors-backend/internal/handlers"
	"dumdoors-backend/internal/logging"
	"dumdoors-backend/internal/middleware"
	"dumdoors-backend/internal/monitoring"
	"dumdoors-backend/internal/repositories"
	"dumdoors-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize structured logging
	logLevel := logging.LevelInfo
	if cfg.Environment == "development" {
		logLevel = logging.LevelDebug
	}
	logging.InitializeLogger("dumdoors-backend", "1.0.0", logLevel)
	logger := logging.GetLogger()

	logger.Info("Starting DumDoors backend service")

	// Initialize metrics collection
	metricsCollector := monitoring.GetGlobalMetricsCollector()
	systemMetrics := monitoring.NewSystemMetrics(metricsCollector)
	
	// Start system metrics collection
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go systemMetrics.StartSystemMetricsCollection(ctx, 30*time.Second)

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
	leaderboardRepo := repositories.NewLeaderboardRepository(dbManager.MongoDB, dbManager.Redis)

	// Initialize services
	wsManager := services.NewWebSocketManager()
	aiClient := services.NewAIClient(cfg.AIServiceURL, dbManager.Redis) // Use basic AI client
	progressService := services.NewProgressService(gameSessionRepo, playerPathRepo, wsManager)
	leaderboardService := services.NewLeaderboardService(leaderboardRepo, gameSessionRepo)
	gameService := services.NewGameService(gameSessionRepo, doorRepo, playerPathRepo, wsManager, aiClient, progressService, leaderboardService)
	devvitService := services.NewDevvitIntegration()

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler()
	gameHandler := handlers.NewGameHandler(gameService, progressService, leaderboardService)
	devvitHandler := handlers.NewDevvitHandler(devvitService)
	wsHandler := handlers.NewWebSocketHandler(wsManager, gameService)
	errorReportingHandler := handlers.NewErrorReportingHandler()
	monitoringHandler := handlers.NewMonitoringHandler()

	// Create Fiber app with enhanced error handling
	app := fiber.New(fiber.Config{
		AppName:      "DumDoors Backend v1.0",
		ErrorHandler: middleware.ErrorHandler(),
	})

	// Enhanced middleware stack
	app.Use(middleware.RequestID())
	app.Use(middleware.RecoverPanic())
	app.Use(middleware.MetricsMiddleware())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID",
		AllowCredentials: false,
	}))

	// Custom logging middleware using structured logger
	app.Use(func(c *fiber.Ctx) error {
		start := time.Now()
		
		// Process request
		err := c.Next()
		
		// Log request
		duration := time.Since(start)
		requestLogger := logger.WithRequestID(c.Get("X-Request-ID", "unknown"))
		
		requestLogger.WithFields(map[string]interface{}{
			"method":      c.Method(),
			"path":        c.Path(),
			"status_code": c.Response().StatusCode(),
			"duration_ms": duration.Milliseconds(),
			"ip":          c.IP(),
			"user_agent":  c.Get("User-Agent"),
		}).Info("HTTP request processed")
		
		return err
	})

	// Health check endpoints
	app.Get("/health", healthHandler.CheckHealth)
	app.Get("/health/ready", healthHandler.CheckReadiness)
	app.Get("/health/live", healthHandler.CheckLiveness)
	app.Get("/health/dashboard", monitoringHandler.GetHealthDashboard)
	
	// Monitoring and metrics endpoints
	app.Get("/metrics", monitoringHandler.GetMetrics)
	app.Get("/metrics/prometheus", monitoringHandler.GetPrometheusMetrics)
	app.Get("/metrics/system", monitoringHandler.GetSystemInfo)
	app.Get("/metrics/performance", monitoringHandler.GetPerformanceStats)
	app.Post("/metrics/reset", monitoringHandler.ResetMetrics)
	
	// Database health check endpoint
	app.Get("/health/db", func(c *fiber.Ctx) error {
		ctx := context.Background()
		if err := dbManager.HealthCheck(ctx); err != nil {
			return middleware.ServiceUnavailableError("Database health check failed").WithCause(err)
		}
		return c.JSON(fiber.Map{
			"status":    "healthy",
			"databases": []string{"mongodb", "neo4j", "redis"},
		})
	})

	// API routes
	api := app.Group("/api")
	api.Get("/", gameHandler.GetAPIInfo)
	
	// Error reporting endpoint
	api.Post("/errors", errorReportingHandler.ReportError)
	api.Get("/errors/stats", errorReportingHandler.GetErrorStats)
	
	// Devvit integration routes (migrated from Express server)
	api.Get("/init", devvitHandler.InitGame)

	// Game routes
	game := api.Group("/game")
	game.Post("/create", gameHandler.CreateSession)
	game.Post("/join/:sessionId", gameHandler.JoinSession)
	game.Get("/status/:sessionId", gameHandler.GetSessionStatus)
	game.Post("/start/:sessionId", gameHandler.StartGame)
	game.Post("/start-with-door/:sessionId", gameHandler.StartGameWithDoor)
	game.Get("/next-door", gameHandler.GetNextDoor)
	game.Post("/submit-response", gameHandler.SubmitResponse)
	
	// Progress tracking routes
	game.Get("/progress/:sessionId", gameHandler.GetSessionProgress)
	game.Get("/progress/:sessionId/player/:playerId", gameHandler.GetPlayerProgress)
	game.Get("/progress/:sessionId/realtime", gameHandler.GetRealTimeProgress)
	game.Post("/progress/:sessionId/broadcast", gameHandler.BroadcastProgressUpdate)
	game.Get("/leaderboard/:sessionId", gameHandler.GetLeaderboard)
	
	// Global leaderboard routes
	api.Get("/leaderboard", gameHandler.GetGlobalLeaderboard)
	api.Get("/leaderboard/stats", gameHandler.GetLeaderboardStats)
	api.Get("/leaderboard/fastest", gameHandler.GetFastestCompletions)
	api.Get("/leaderboard/highest-averages", gameHandler.GetHighestAverageScores)
	api.Get("/leaderboard/player/:playerId/rank/:category", gameHandler.GetPlayerRank)

	// WebSocket routes
	ws := api.Group("/ws")
	ws.Get("/connect", wsHandler.UpgradeConnection)
	ws.Get("/status/:sessionId", wsHandler.GetConnectionStatus)
	ws.Post("/broadcast/:sessionId", wsHandler.BroadcastMessage)

	// Internal Devvit routes
	internal := app.Group("/internal")
	internal.Post("/on-app-install", devvitHandler.OnAppInstall)
	internal.Post("/menu/post-create", devvitHandler.MenuPostCreate)



	logger.WithFields(map[string]interface{}{
		"port":           cfg.Port,
		"mongodb_uri":    cfg.MongoURI,
		"neo4j_uri":      cfg.Neo4jURI,
		"redis_uri":      cfg.RedisURI,
		"ai_service_url": cfg.AIServiceURL,
		"environment":    cfg.Environment,
	}).Info("DumDoors backend configuration loaded")
	
	// Start server in a goroutine
	go func() {
		logger.WithFields(map[string]interface{}{
			"port": cfg.Port,
		}).Info("Starting HTTP server")
		
		if err := app.Listen(":" + cfg.Port); err != nil {
			logger.Error("Server startup failed", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	logger.Info("Shutdown signal received, starting graceful shutdown")
	
	// Cancel context to stop background tasks
	cancel()
	
	// Shutdown server with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		logger.Error("Server shutdown failed", err)
	} else {
		logger.Info("Server shutdown completed successfully")
	}
}

// Note: Custom error handler removed - now using middleware.ErrorHandler()