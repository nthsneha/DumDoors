package middleware

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"time"
)

// RetryConfig holds configuration for retry logic
type RetryConfig struct {
	MaxAttempts     int           // Maximum number of retry attempts
	InitialDelay    time.Duration // Initial delay between retries
	MaxDelay        time.Duration // Maximum delay between retries
	BackoffFactor   float64       // Exponential backoff factor
	Jitter          bool          // Add random jitter to delays
	RetryableErrors []string      // List of retryable error types
}

// DefaultRetryConfig returns default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:   3,
		InitialDelay:  100 * time.Millisecond,
		MaxDelay:      5 * time.Second,
		BackoffFactor: 2.0,
		Jitter:        true,
		RetryableErrors: []string{
			"network",
			"timeout",
			"service_unavailable",
		},
	}
}

// RetryableFunc represents a function that can be retried
type RetryableFunc func(context.Context) error

// IsRetryable checks if an error is retryable based on configuration
func (rc *RetryConfig) IsRetryable(err error) bool {
	if err == nil {
		return false
	}

	// Check for specific retryable error types
	if appErr, ok := err.(*AppError); ok {
		for _, retryableType := range rc.RetryableErrors {
			if string(appErr.Type) == retryableType {
				return true
			}
		}
	}

	// Check for context errors
	if err == context.DeadlineExceeded || err == context.Canceled {
		return false // Don't retry context errors
	}

	// Check for circuit breaker errors
	if IsCircuitBreakerError(err) {
		return false // Don't retry circuit breaker errors
	}

	return false
}

// CalculateDelay calculates the delay for the next retry attempt
func (rc *RetryConfig) CalculateDelay(attempt int) time.Duration {
	if attempt <= 0 {
		return rc.InitialDelay
	}

	// Calculate exponential backoff
	delay := float64(rc.InitialDelay) * math.Pow(rc.BackoffFactor, float64(attempt-1))

	// Apply maximum delay limit
	if delay > float64(rc.MaxDelay) {
		delay = float64(rc.MaxDelay)
	}

	// Add jitter if enabled
	if rc.Jitter {
		jitter := rand.Float64() * 0.1 * delay // 10% jitter
		delay += jitter
	}

	return time.Duration(delay)
}

// Retry executes a function with retry logic
func Retry(ctx context.Context, config RetryConfig, fn RetryableFunc) error {
	var lastErr error

	for attempt := 0; attempt < config.MaxAttempts; attempt++ {
		// Execute function
		err := fn(ctx)
		if err == nil {
			return nil // Success
		}

		lastErr = err

		// Check if error is retryable
		if !config.IsRetryable(err) {
			return err // Not retryable, return immediately
		}

		// Check if we've reached max attempts
		if attempt == config.MaxAttempts-1 {
			break // Last attempt, don't delay
		}

		// Calculate delay for next attempt
		delay := config.CalculateDelay(attempt + 1)

		// Wait with context cancellation support
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			// Continue to next attempt
		}
	}

	// All attempts failed, return last error
	if appErr, ok := lastErr.(*AppError); ok {
		return appErr.WithDetails("retry_attempts", config.MaxAttempts)
	}

	return &RetryableError{
		Err:        lastErr,
		RetryAfter: config.CalculateDelay(config.MaxAttempts),
	}
}

// RetryWithCircuitBreaker combines retry logic with circuit breaker
func RetryWithCircuitBreaker(ctx context.Context, cbName string, retryConfig RetryConfig, fn RetryableFunc) error {
	cb := GetCircuitBreaker(cbName)

	return Retry(ctx, retryConfig, func(ctx context.Context) error {
		return cb.Execute(ctx, fn)
	})
}

// ExponentialBackoff implements exponential backoff with jitter
type ExponentialBackoff struct {
	InitialDelay  time.Duration
	MaxDelay      time.Duration
	BackoffFactor float64
	Jitter        bool
	attempt       int
}

// NewExponentialBackoff creates a new exponential backoff instance
func NewExponentialBackoff(initialDelay, maxDelay time.Duration, backoffFactor float64, jitter bool) *ExponentialBackoff {
	return &ExponentialBackoff{
		InitialDelay:  initialDelay,
		MaxDelay:      maxDelay,
		BackoffFactor: backoffFactor,
		Jitter:        jitter,
	}
}

// NextDelay calculates the next delay and increments the attempt counter
func (eb *ExponentialBackoff) NextDelay() time.Duration {
	delay := eb.CalculateDelay(eb.attempt)
	eb.attempt++
	return delay
}

// CalculateDelay calculates delay for a specific attempt
func (eb *ExponentialBackoff) CalculateDelay(attempt int) time.Duration {
	if attempt <= 0 {
		return eb.InitialDelay
	}

	delay := float64(eb.InitialDelay) * math.Pow(eb.BackoffFactor, float64(attempt))

	if delay > float64(eb.MaxDelay) {
		delay = float64(eb.MaxDelay)
	}

	if eb.Jitter {
		jitter := rand.Float64() * 0.1 * delay
		delay += jitter
	}

	return time.Duration(delay)
}

// Reset resets the attempt counter
func (eb *ExponentialBackoff) Reset() {
	eb.attempt = 0
}

// GetAttempt returns the current attempt number
func (eb *ExponentialBackoff) GetAttempt() int {
	return eb.attempt
}

// RetryableHTTPClient wraps HTTP operations with retry logic
type RetryableHTTPClient struct {
	config RetryConfig
	cb     *CircuitBreaker
}

// NewRetryableHTTPClient creates a new retryable HTTP client
func NewRetryableHTTPClient(serviceName string, config RetryConfig) *RetryableHTTPClient {
	cbConfig := CircuitBreakerConfig{
		MaxFailures:      5,
		ResetTimeout:     30 * time.Second,
		SuccessThreshold: 3,
		Timeout:          10 * time.Second,
	}

	return &RetryableHTTPClient{
		config: config,
		cb:     GetCircuitBreakerWithConfig(fmt.Sprintf("http_%s", serviceName), cbConfig),
	}
}

// Execute executes an HTTP operation with retry and circuit breaker
func (rhc *RetryableHTTPClient) Execute(ctx context.Context, operation RetryableFunc) error {
	return Retry(ctx, rhc.config, func(ctx context.Context) error {
		return rhc.cb.Execute(ctx, operation)
	})
}

// GetStats returns statistics for the HTTP client
func (rhc *RetryableHTTPClient) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"retry_config":      rhc.config,
		"circuit_breaker":   rhc.cb.GetStats(),
	}
}