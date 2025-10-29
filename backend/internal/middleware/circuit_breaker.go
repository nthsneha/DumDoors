package middleware

import (
	"context"
	"sync"
	"time"
)

// CircuitBreakerState represents the state of a circuit breaker
type CircuitBreakerState int

const (
	StateClosed CircuitBreakerState = iota
	StateHalfOpen
	StateOpen
)

func (s CircuitBreakerState) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateHalfOpen:
		return "half-open"
	case StateOpen:
		return "open"
	default:
		return "unknown"
	}
}

// CircuitBreakerConfig holds configuration for circuit breaker
type CircuitBreakerConfig struct {
	MaxFailures     int           // Maximum failures before opening
	ResetTimeout    time.Duration // Time to wait before trying half-open
	SuccessThreshold int          // Successes needed in half-open to close
	Timeout         time.Duration // Request timeout
}

// DefaultCircuitBreakerConfig returns default configuration
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		MaxFailures:      5,
		ResetTimeout:     30 * time.Second,
		SuccessThreshold: 3,
		Timeout:          10 * time.Second,
	}
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	config       CircuitBreakerConfig
	state        CircuitBreakerState
	failures     int
	successes    int
	lastFailTime time.Time
	mutex        sync.RWMutex
	name         string
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(name string, config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		config: config,
		state:  StateClosed,
		name:   name,
	}
}

// Execute executes a function with circuit breaker protection
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func(context.Context) error) error {
	// Check if circuit breaker allows execution
	if !cb.allowRequest() {
		return &CircuitBreakerError{
			Service: cb.name,
			State:   cb.getState().String(),
		}
	}

	// Create context with timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, cb.config.Timeout)
	defer cancel()

	// Execute function
	err := fn(timeoutCtx)

	// Record result
	cb.recordResult(err)

	return err
}

// allowRequest checks if the circuit breaker allows the request
func (cb *CircuitBreaker) allowRequest() bool {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		// Check if we should transition to half-open
		if time.Since(cb.lastFailTime) >= cb.config.ResetTimeout {
			cb.state = StateHalfOpen
			cb.successes = 0
			return true
		}
		return false
	case StateHalfOpen:
		return true
	default:
		return false
	}
}

// recordResult records the result of an operation
func (cb *CircuitBreaker) recordResult(err error) {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	if err != nil {
		cb.recordFailure()
	} else {
		cb.recordSuccess()
	}
}

// recordFailure records a failure
func (cb *CircuitBreaker) recordFailure() {
	cb.failures++
	cb.lastFailTime = time.Now()

	switch cb.state {
	case StateClosed:
		if cb.failures >= cb.config.MaxFailures {
			cb.state = StateOpen
		}
	case StateHalfOpen:
		cb.state = StateOpen
	}
}

// recordSuccess records a success
func (cb *CircuitBreaker) recordSuccess() {
	switch cb.state {
	case StateClosed:
		cb.failures = 0
	case StateHalfOpen:
		cb.successes++
		if cb.successes >= cb.config.SuccessThreshold {
			cb.state = StateClosed
			cb.failures = 0
			cb.successes = 0
		}
	}
}

// getState returns the current state
func (cb *CircuitBreaker) getState() CircuitBreakerState {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()
	return cb.state
}

// GetStats returns circuit breaker statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()

	return map[string]interface{}{
		"name":           cb.name,
		"state":          cb.state.String(),
		"failures":       cb.failures,
		"successes":      cb.successes,
		"last_fail_time": cb.lastFailTime,
		"config":         cb.config,
	}
}

// CircuitBreakerManager manages multiple circuit breakers
type CircuitBreakerManager struct {
	breakers map[string]*CircuitBreaker
	mutex    sync.RWMutex
}

// NewCircuitBreakerManager creates a new circuit breaker manager
func NewCircuitBreakerManager() *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*CircuitBreaker),
	}
}

// GetOrCreate gets an existing circuit breaker or creates a new one
func (cbm *CircuitBreakerManager) GetOrCreate(name string, config CircuitBreakerConfig) *CircuitBreaker {
	cbm.mutex.Lock()
	defer cbm.mutex.Unlock()

	if cb, exists := cbm.breakers[name]; exists {
		return cb
	}

	cb := NewCircuitBreaker(name, config)
	cbm.breakers[name] = cb
	return cb
}

// GetStats returns statistics for all circuit breakers
func (cbm *CircuitBreakerManager) GetStats() map[string]interface{} {
	cbm.mutex.RLock()
	defer cbm.mutex.RUnlock()

	stats := make(map[string]interface{})
	for name, cb := range cbm.breakers {
		stats[name] = cb.GetStats()
	}

	return stats
}

// Global circuit breaker manager instance
var globalCBManager = NewCircuitBreakerManager()

// GetCircuitBreaker gets or creates a circuit breaker with default config
func GetCircuitBreaker(name string) *CircuitBreaker {
	return globalCBManager.GetOrCreate(name, DefaultCircuitBreakerConfig())
}

// GetCircuitBreakerWithConfig gets or creates a circuit breaker with custom config
func GetCircuitBreakerWithConfig(name string, config CircuitBreakerConfig) *CircuitBreaker {
	return globalCBManager.GetOrCreate(name, config)
}

// GetAllCircuitBreakerStats returns stats for all circuit breakers
func GetAllCircuitBreakerStats() map[string]interface{} {
	return globalCBManager.GetStats()
}