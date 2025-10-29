package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"runtime/debug"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ErrorType represents different types of errors
type ErrorType string

const (
	ErrorTypeValidation    ErrorType = "validation"
	ErrorTypeNotFound      ErrorType = "not_found"
	ErrorTypeUnauthorized  ErrorType = "unauthorized"
	ErrorTypeForbidden     ErrorType = "forbidden"
	ErrorTypeConflict      ErrorType = "conflict"
	ErrorTypeRateLimit     ErrorType = "rate_limit"
	ErrorTypeServiceUnavailable ErrorType = "service_unavailable"
	ErrorTypeInternal      ErrorType = "internal"
	ErrorTypeTimeout       ErrorType = "timeout"
	ErrorTypeNetwork       ErrorType = "network"
)

// AppError represents a structured application error
type AppError struct {
	Type       ErrorType              `json:"type"`
	Message    string                 `json:"message"`
	Details    map[string]interface{} `json:"details,omitempty"`
	Code       string                 `json:"code,omitempty"`
	StatusCode int                    `json:"-"`
	Cause      error                  `json:"-"`
	Timestamp  time.Time              `json:"timestamp"`
	RequestID  string                 `json:"request_id,omitempty"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	return e.Message
}

// NewAppError creates a new application error
func NewAppError(errorType ErrorType, message string, statusCode int) *AppError {
	return &AppError{
		Type:       errorType,
		Message:    message,
		StatusCode: statusCode,
		Timestamp:  time.Now(),
		Details:    make(map[string]interface{}),
	}
}

// WithDetails adds details to the error
func (e *AppError) WithDetails(key string, value interface{}) *AppError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// WithCode adds an error code
func (e *AppError) WithCode(code string) *AppError {
	e.Code = code
	return e
}

// WithCause adds the underlying cause
func (e *AppError) WithCause(cause error) *AppError {
	e.Cause = cause
	return e
}

// WithRequestID adds request ID for tracing
func (e *AppError) WithRequestID(requestID string) *AppError {
	e.RequestID = requestID
	return e
}

// Common error constructors
func ValidationError(message string) *AppError {
	return NewAppError(ErrorTypeValidation, message, fiber.StatusBadRequest)
}

func NotFoundError(message string) *AppError {
	return NewAppError(ErrorTypeNotFound, message, fiber.StatusNotFound)
}

func UnauthorizedError(message string) *AppError {
	return NewAppError(ErrorTypeUnauthorized, message, fiber.StatusUnauthorized)
}

func ForbiddenError(message string) *AppError {
	return NewAppError(ErrorTypeForbidden, message, fiber.StatusForbidden)
}

func ConflictError(message string) *AppError {
	return NewAppError(ErrorTypeConflict, message, fiber.StatusConflict)
}

func ServiceUnavailableError(message string) *AppError {
	return NewAppError(ErrorTypeServiceUnavailable, message, fiber.StatusServiceUnavailable)
}

func InternalError(message string) *AppError {
	return NewAppError(ErrorTypeInternal, message, fiber.StatusInternalServerError)
}

func TimeoutError(message string) *AppError {
	return NewAppError(ErrorTypeTimeout, message, fiber.StatusRequestTimeout)
}

func NetworkError(message string) *AppError {
	return NewAppError(ErrorTypeNetwork, message, fiber.StatusBadGateway)
}

// ErrorHandler middleware for centralized error handling
func ErrorHandler() fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		// Get request ID for tracing
		requestID := c.Get("X-Request-ID", "unknown")
		
		// Handle different error types
		var appErr *AppError
		
		switch e := err.(type) {
		case *AppError:
			appErr = e
		case *fiber.Error:
			appErr = NewAppError(ErrorTypeInternal, e.Message, e.Code)
		default:
			// Handle context errors
			if err == context.DeadlineExceeded {
				appErr = TimeoutError("Request timeout")
			} else if err == context.Canceled {
				appErr = NewAppError(ErrorTypeInternal, "Request canceled", fiber.StatusRequestTimeout)
			} else {
				appErr = InternalError("Internal server error")
			}
		}
		
		// Add request ID for tracing
		appErr.WithRequestID(requestID)
		
		// Log error with appropriate level
		logError(appErr, c)
		
		// Return error response
		return c.Status(appErr.StatusCode).JSON(fiber.Map{
			"error":     true,
			"type":      appErr.Type,
			"message":   appErr.Message,
			"code":      appErr.Code,
			"details":   appErr.Details,
			"timestamp": appErr.Timestamp,
			"requestId": appErr.RequestID,
		})
	}
}

// logError logs the error with appropriate level and context
func logError(err *AppError, c *fiber.Ctx) {
	// Prepare log context
	logData := map[string]interface{}{
		"error_type":   err.Type,
		"error_code":   err.Code,
		"status_code":  err.StatusCode,
		"message":      err.Message,
		"request_id":   err.RequestID,
		"method":       c.Method(),
		"path":         c.Path(),
		"user_agent":   c.Get("User-Agent"),
		"ip":           c.IP(),
		"timestamp":    err.Timestamp,
	}
	
	// Add details if present
	if len(err.Details) > 0 {
		logData["details"] = err.Details
	}
	
	// Add cause if present
	if err.Cause != nil {
		logData["cause"] = err.Cause.Error()
	}
	
	// Convert to JSON for structured logging
	logJSON, _ := json.Marshal(logData)
	
	// Log with appropriate level
	switch err.Type {
	case ErrorTypeValidation, ErrorTypeNotFound, ErrorTypeUnauthorized, ErrorTypeForbidden:
		// Client errors - log as info
		log.Printf("CLIENT_ERROR: %s", logJSON)
	case ErrorTypeTimeout, ErrorTypeNetwork, ErrorTypeServiceUnavailable:
		// Service errors - log as warning
		log.Printf("SERVICE_ERROR: %s", logJSON)
	case ErrorTypeInternal:
		// Server errors - log as error with stack trace
		logData["stack_trace"] = string(debug.Stack())
		logJSON, _ = json.Marshal(logData)
		log.Printf("SERVER_ERROR: %s", logJSON)
	default:
		log.Printf("UNKNOWN_ERROR: %s", logJSON)
	}
}

// RecoverPanic middleware to handle panics gracefully
func RecoverPanic() fiber.Handler {
	return func(c *fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				requestID := c.Get("X-Request-ID", "unknown")
				
				// Log panic with stack trace
				log.Printf("PANIC_RECOVERED: request_id=%s, panic=%v, stack=%s", 
					requestID, r, string(debug.Stack()))
				
				// Create error response
				err := InternalError("Internal server error").
					WithRequestID(requestID).
					WithDetails("panic", fmt.Sprintf("%v", r))
				
				// Send error response
				c.Status(err.StatusCode).JSON(fiber.Map{
					"error":     true,
					"type":      err.Type,
					"message":   err.Message,
					"requestId": err.RequestID,
					"timestamp": err.Timestamp,
				})
			}
		}()
		
		return c.Next()
	}
}

// RequestID middleware to add unique request IDs
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check if request ID already exists
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			// Generate new request ID
			requestID = fmt.Sprintf("%d-%s", time.Now().UnixNano(), generateRandomString(8))
		}
		
		// Set request ID in context and response header
		c.Set("X-Request-ID", requestID)
		c.Locals("request_id", requestID)
		
		return c.Next()
	}
}

// generateRandomString generates a random string of specified length
func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

// CircuitBreakerError represents a circuit breaker error
type CircuitBreakerError struct {
	Service string
	State   string
}

func (e *CircuitBreakerError) Error() string {
	return fmt.Sprintf("circuit breaker open for service: %s (state: %s)", e.Service, e.State)
}

// IsCircuitBreakerError checks if error is a circuit breaker error
func IsCircuitBreakerError(err error) bool {
	_, ok := err.(*CircuitBreakerError)
	return ok
}

// RetryableError represents an error that can be retried
type RetryableError struct {
	Err        error
	RetryAfter time.Duration
}

func (e *RetryableError) Error() string {
	return fmt.Sprintf("retryable error: %v (retry after: %v)", e.Err, e.RetryAfter)
}

// IsRetryableError checks if error is retryable
func IsRetryableError(err error) bool {
	_, ok := err.(*RetryableError)
	return ok
}