package handlers

import (
	"dumdoors-backend/internal/middleware"
	"dumdoors-backend/internal/monitoring"
	"fmt"
	"runtime"
	"time"

	"github.com/gofiber/fiber/v2"
)

// MonitoringHandler handles monitoring and observability endpoints
type MonitoringHandler struct {
	metricsCollector *monitoring.MetricsCollector
}

// NewMonitoringHandler creates a new monitoring handler
func NewMonitoringHandler() *MonitoringHandler {
	return &MonitoringHandler{
		metricsCollector: monitoring.GetGlobalMetricsCollector(),
	}
}

// GetMetrics returns all collected metrics
func (h *MonitoringHandler) GetMetrics(c *fiber.Ctx) error {
	metrics := h.metricsCollector.GetMetrics()
	
	return c.JSON(fiber.Map{
		"timestamp": time.Now().UTC(),
		"service":   "dumdoors-backend",
		"version":   "1.0.0",
		"metrics":   metrics,
	})
}

// GetPrometheusMetrics returns metrics in Prometheus format
func (h *MonitoringHandler) GetPrometheusMetrics(c *fiber.Ctx) error {
	metrics := h.metricsCollector.GetMetrics()
	
	// Convert to Prometheus format
	var prometheusOutput string
	for name, metric := range metrics {
		// Add help text
		if metric.Help != "" {
			prometheusOutput += "# HELP " + name + " " + metric.Help + "\n"
		}
		
		// Add type
		prometheusOutput += "# TYPE " + name + " " + string(metric.Type) + "\n"
		
		// Add metric value with labels
		if len(metric.Labels) > 0 {
			labelStr := ""
			for k, v := range metric.Labels {
				if labelStr != "" {
					labelStr += ","
				}
				labelStr += k + "=\"" + v + "\""
			}
			prometheusOutput += name + "{" + labelStr + "} " + formatFloat(metric.Value) + "\n"
		} else {
			prometheusOutput += name + " " + formatFloat(metric.Value) + "\n"
		}
		prometheusOutput += "\n"
	}
	
	c.Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	return c.SendString(prometheusOutput)
}

// GetSystemInfo returns system information
func (h *MonitoringHandler) GetSystemInfo(c *fiber.Ctx) error {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	systemInfo := fiber.Map{
		"timestamp": time.Now().UTC(),
		"service":   "dumdoors-backend",
		"version":   "1.0.0",
		"runtime": fiber.Map{
			"go_version":      runtime.Version(),
			"goroutines":      runtime.NumGoroutine(),
			"cpu_count":       runtime.NumCPU(),
			"gc_runs":         m.NumGC,
			"memory": fiber.Map{
				"alloc_bytes":      m.Alloc,
				"total_alloc_bytes": m.TotalAlloc,
				"sys_bytes":        m.Sys,
				"heap_alloc_bytes": m.HeapAlloc,
				"heap_sys_bytes":   m.HeapSys,
				"heap_objects":     m.HeapObjects,
			},
		},
		"circuit_breakers": middleware.GetAllCircuitBreakerStats(),
	}
	
	return c.JSON(systemInfo)
}

// GetPerformanceStats returns performance statistics
func (h *MonitoringHandler) GetPerformanceStats(c *fiber.Ctx) error {
	metrics := h.metricsCollector.GetMetrics()
	
	// Calculate performance statistics
	stats := fiber.Map{
		"timestamp": time.Now().UTC(),
		"service":   "dumdoors-backend",
		"performance": fiber.Map{
			"requests": fiber.Map{
				"total":        getMetricValue(metrics, "http_requests_total"),
				"errors":       getMetricValue(metrics, "errors_total"),
				"avg_duration": getMetricValue(metrics, "http_request_duration_seconds"),
			},
			"game": fiber.Map{
				"active_sessions":    getMetricValue(metrics, "game_sessions_active"),
				"active_players":     getMetricValue(metrics, "players_active"),
				"active_connections": getMetricValue(metrics, "websocket_connections_active"),
			},
			"ai_service": fiber.Map{
				"total_calls":    getMetricValue(metrics, "ai_service_calls_total"),
				"avg_duration":   getMetricValue(metrics, "ai_service_call_duration_seconds"),
			},
			"database": fiber.Map{
				"total_operations": getMetricValue(metrics, "database_operations_total"),
				"avg_duration":     getMetricValue(metrics, "database_operation_duration_seconds"),
			},
		},
	}
	
	return c.JSON(stats)
}

// GetHealthDashboard returns a comprehensive health dashboard
func (h *MonitoringHandler) GetHealthDashboard(c *fiber.Ctx) error {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	metrics := h.metricsCollector.GetMetrics()
	circuitBreakers := middleware.GetAllCircuitBreakerStats()
	
	// Determine overall health status
	overallHealth := "healthy"
	healthChecks := make(map[string]interface{})
	
	// Check circuit breakers
	for name, cb := range circuitBreakers {
		if cbMap, ok := cb.(map[string]interface{}); ok {
			if state, exists := cbMap["state"]; exists && state != "closed" {
				overallHealth = "degraded"
			}
			healthChecks["circuit_breaker_"+name] = cbMap
		}
	}
	
	// Check memory usage (warn if > 1GB)
	if m.Alloc > 1024*1024*1024 {
		overallHealth = "degraded"
		healthChecks["memory_usage"] = fiber.Map{
			"status": "warning",
			"message": "High memory usage detected",
			"alloc_bytes": m.Alloc,
		}
	} else {
		healthChecks["memory_usage"] = fiber.Map{
			"status": "ok",
			"alloc_bytes": m.Alloc,
		}
	}
	
	// Check error rate
	totalRequests := getMetricValue(metrics, "http_requests_total")
	totalErrors := getMetricValue(metrics, "errors_total")
	errorRate := float64(0)
	if totalRequests > 0 {
		errorRate = totalErrors / totalRequests * 100
	}
	
	if errorRate > 5 { // More than 5% error rate
		overallHealth = "degraded"
		healthChecks["error_rate"] = fiber.Map{
			"status": "warning",
			"message": "High error rate detected",
			"error_rate_percent": errorRate,
		}
	} else {
		healthChecks["error_rate"] = fiber.Map{
			"status": "ok",
			"error_rate_percent": errorRate,
		}
	}
	
	dashboard := fiber.Map{
		"timestamp":      time.Now().UTC(),
		"service":        "dumdoors-backend",
		"version":        "1.0.0",
		"overall_health": overallHealth,
		"uptime_seconds": time.Since(time.Now()).Seconds(), // This would be actual uptime in real implementation
		"health_checks":  healthChecks,
		"metrics_summary": fiber.Map{
			"total_requests":      totalRequests,
			"total_errors":        totalErrors,
			"error_rate_percent":  errorRate,
			"active_sessions":     getMetricValue(metrics, "game_sessions_active"),
			"active_players":      getMetricValue(metrics, "players_active"),
			"active_connections":  getMetricValue(metrics, "websocket_connections_active"),
			"memory_alloc_mb":     float64(m.Alloc) / 1024 / 1024,
			"goroutines":          runtime.NumGoroutine(),
		},
		"circuit_breakers": circuitBreakers,
	}
	
	// Set appropriate HTTP status based on health
	if overallHealth == "healthy" {
		return c.JSON(dashboard)
	} else {
		return c.Status(fiber.StatusServiceUnavailable).JSON(dashboard)
	}
}

// ResetMetrics resets all metrics (for testing/debugging)
func (h *MonitoringHandler) ResetMetrics(c *fiber.Ctx) error {
	// In a real implementation, you might want to restrict this endpoint
	// or require authentication
	
	h.metricsCollector = monitoring.NewMetricsCollector()
	
	return c.JSON(fiber.Map{
		"success":   true,
		"message":   "Metrics reset successfully",
		"timestamp": time.Now().UTC(),
	})
}

// Helper functions
func getMetricValue(metrics map[string]*monitoring.Metric, name string) float64 {
	if metric, exists := metrics[name]; exists {
		return metric.Value
	}
	return 0
}

func formatFloat(f float64) string {
	return fmt.Sprintf("%.6f", f)
}