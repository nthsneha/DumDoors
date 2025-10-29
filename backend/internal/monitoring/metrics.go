package monitoring

import (
	"context"
	"encoding/json"
	"runtime"
	"sync"
	"time"
)

// MetricType represents the type of metric
type MetricType string

const (
	MetricTypeCounter   MetricType = "counter"
	MetricTypeGauge     MetricType = "gauge"
	MetricTypeHistogram MetricType = "histogram"
	MetricTypeTiming    MetricType = "timing"
)

// Metric represents a single metric
type Metric struct {
	Name      string                 `json:"name"`
	Type      MetricType             `json:"type"`
	Value     float64                `json:"value"`
	Labels    map[string]string      `json:"labels,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Help      string                 `json:"help,omitempty"`
	Unit      string                 `json:"unit,omitempty"`
}

// MetricsCollector collects and manages application metrics
type MetricsCollector struct {
	metrics map[string]*Metric
	mutex   sync.RWMutex
	
	// Built-in metrics
	requestCount    *Counter
	requestDuration *Histogram
	errorCount      *Counter
	activeConnections *Gauge
	gameSessionCount  *Gauge
	playerCount       *Gauge
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	mc := &MetricsCollector{
		metrics: make(map[string]*Metric),
	}
	
	// Initialize built-in metrics
	mc.requestCount = mc.NewCounter("http_requests_total", "Total number of HTTP requests", map[string]string{})
	mc.requestDuration = mc.NewHistogram("http_request_duration_seconds", "HTTP request duration in seconds", map[string]string{})
	mc.errorCount = mc.NewCounter("errors_total", "Total number of errors", map[string]string{})
	mc.activeConnections = mc.NewGauge("websocket_connections_active", "Number of active WebSocket connections", map[string]string{})
	mc.gameSessionCount = mc.NewGauge("game_sessions_active", "Number of active game sessions", map[string]string{})
	mc.playerCount = mc.NewGauge("players_active", "Number of active players", map[string]string{})
	
	return mc
}

// Counter represents a counter metric
type Counter struct {
	collector *MetricsCollector
	name      string
	help      string
	labels    map[string]string
	value     float64
	mutex     sync.Mutex
}

// NewCounter creates a new counter metric
func (mc *MetricsCollector) NewCounter(name, help string, labels map[string]string) *Counter {
	counter := &Counter{
		collector: mc,
		name:      name,
		help:      help,
		labels:    labels,
	}
	
	mc.registerMetric(name, MetricTypeCounter, help, labels)
	return counter
}

// Inc increments the counter by 1
func (c *Counter) Inc() {
	c.Add(1)
}

// Add adds the given value to the counter
func (c *Counter) Add(value float64) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	
	c.value += value
	c.collector.updateMetric(c.name, c.value, c.labels)
}

// Get returns the current counter value
func (c *Counter) Get() float64 {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	return c.value
}

// Gauge represents a gauge metric
type Gauge struct {
	collector *MetricsCollector
	name      string
	help      string
	labels    map[string]string
	value     float64
	mutex     sync.Mutex
}

// NewGauge creates a new gauge metric
func (mc *MetricsCollector) NewGauge(name, help string, labels map[string]string) *Gauge {
	gauge := &Gauge{
		collector: mc,
		name:      name,
		help:      help,
		labels:    labels,
	}
	
	mc.registerMetric(name, MetricTypeGauge, help, labels)
	return gauge
}

// Set sets the gauge to the given value
func (g *Gauge) Set(value float64) {
	g.mutex.Lock()
	defer g.mutex.Unlock()
	
	g.value = value
	g.collector.updateMetric(g.name, g.value, g.labels)
}

// Inc increments the gauge by 1
func (g *Gauge) Inc() {
	g.Add(1)
}

// Dec decrements the gauge by 1
func (g *Gauge) Dec() {
	g.Add(-1)
}

// Add adds the given value to the gauge
func (g *Gauge) Add(value float64) {
	g.mutex.Lock()
	defer g.mutex.Unlock()
	
	g.value += value
	g.collector.updateMetric(g.name, g.value, g.labels)
}

// Get returns the current gauge value
func (g *Gauge) Get() float64 {
	g.mutex.Lock()
	defer g.mutex.Unlock()
	return g.value
}

// Histogram represents a histogram metric
type Histogram struct {
	collector *MetricsCollector
	name      string
	help      string
	labels    map[string]string
	buckets   []float64
	counts    []uint64
	sum       float64
	count     uint64
	mutex     sync.Mutex
}

// NewHistogram creates a new histogram metric
func (mc *MetricsCollector) NewHistogram(name, help string, labels map[string]string) *Histogram {
	// Default buckets for HTTP request durations
	buckets := []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
	
	histogram := &Histogram{
		collector: mc,
		name:      name,
		help:      help,
		labels:    labels,
		buckets:   buckets,
		counts:    make([]uint64, len(buckets)+1), // +1 for +Inf bucket
	}
	
	mc.registerMetric(name, MetricTypeHistogram, help, labels)
	return histogram
}

// Observe adds an observation to the histogram
func (h *Histogram) Observe(value float64) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	
	h.sum += value
	h.count++
	
	// Find the appropriate bucket
	for i, bucket := range h.buckets {
		if value <= bucket {
			h.counts[i]++
		}
	}
	// Always increment the +Inf bucket
	h.counts[len(h.buckets)]++
	
	// Update the metric with average value
	average := h.sum / float64(h.count)
	h.collector.updateMetric(h.name, average, h.labels)
}

// Timer provides a convenient way to time operations
type Timer struct {
	histogram *Histogram
	start     time.Time
}

// NewTimer creates a new timer for the histogram
func (h *Histogram) NewTimer() *Timer {
	return &Timer{
		histogram: h,
		start:     time.Now(),
	}
}

// ObserveDuration observes the duration since the timer was created
func (t *Timer) ObserveDuration() {
	duration := time.Since(t.start).Seconds()
	t.histogram.Observe(duration)
}

// registerMetric registers a new metric
func (mc *MetricsCollector) registerMetric(name string, metricType MetricType, help string, labels map[string]string) {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()
	
	mc.metrics[name] = &Metric{
		Name:      name,
		Type:      metricType,
		Value:     0,
		Labels:    labels,
		Timestamp: time.Now(),
		Help:      help,
	}
}

// updateMetric updates an existing metric
func (mc *MetricsCollector) updateMetric(name string, value float64, labels map[string]string) {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()
	
	if metric, exists := mc.metrics[name]; exists {
		metric.Value = value
		metric.Labels = labels
		metric.Timestamp = time.Now()
	}
}

// GetMetrics returns all current metrics
func (mc *MetricsCollector) GetMetrics() map[string]*Metric {
	mc.mutex.RLock()
	defer mc.mutex.RUnlock()
	
	// Create a copy to avoid race conditions
	result := make(map[string]*Metric)
	for name, metric := range mc.metrics {
		metricCopy := *metric
		result[name] = &metricCopy
	}
	
	return result
}

// GetMetricsJSON returns metrics as JSON
func (mc *MetricsCollector) GetMetricsJSON() ([]byte, error) {
	metrics := mc.GetMetrics()
	return json.Marshal(metrics)
}

// Built-in metric accessors
func (mc *MetricsCollector) IncrementRequests(method, path string, statusCode int) {
	labels := map[string]string{
		"method": method,
		"path":   path,
		"status": string(rune(statusCode)),
	}
	counter := mc.NewCounter("http_requests_total", "Total HTTP requests", labels)
	counter.Inc()
}

func (mc *MetricsCollector) ObserveRequestDuration(method, path string, duration time.Duration) {
	labels := map[string]string{
		"method": method,
		"path":   path,
	}
	histogram := mc.NewHistogram("http_request_duration_seconds", "HTTP request duration", labels)
	histogram.Observe(duration.Seconds())
}

func (mc *MetricsCollector) IncrementErrors(errorType, component string) {
	labels := map[string]string{
		"type":      errorType,
		"component": component,
	}
	counter := mc.NewCounter("errors_total", "Total errors", labels)
	counter.Inc()
}

func (mc *MetricsCollector) SetActiveConnections(count int) {
	mc.activeConnections.Set(float64(count))
}

func (mc *MetricsCollector) SetActiveGameSessions(count int) {
	mc.gameSessionCount.Set(float64(count))
}

func (mc *MetricsCollector) SetActivePlayers(count int) {
	mc.playerCount.Set(float64(count))
}

// SystemMetrics collects system-level metrics
type SystemMetrics struct {
	collector *MetricsCollector
}

// NewSystemMetrics creates a new system metrics collector
func NewSystemMetrics(collector *MetricsCollector) *SystemMetrics {
	return &SystemMetrics{
		collector: collector,
	}
}

// CollectSystemMetrics collects current system metrics
func (sm *SystemMetrics) CollectSystemMetrics() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	// Memory metrics
	sm.collector.NewGauge("memory_alloc_bytes", "Allocated memory in bytes", nil).Set(float64(m.Alloc))
	sm.collector.NewGauge("memory_total_alloc_bytes", "Total allocated memory in bytes", nil).Set(float64(m.TotalAlloc))
	sm.collector.NewGauge("memory_sys_bytes", "System memory in bytes", nil).Set(float64(m.Sys))
	sm.collector.NewGauge("memory_heap_alloc_bytes", "Heap allocated memory in bytes", nil).Set(float64(m.HeapAlloc))
	sm.collector.NewGauge("memory_heap_sys_bytes", "Heap system memory in bytes", nil).Set(float64(m.HeapSys))
	
	// Garbage collection metrics
	sm.collector.NewCounter("gc_runs_total", "Total number of GC runs", nil).Add(float64(m.NumGC))
	sm.collector.NewGauge("gc_pause_ns", "GC pause time in nanoseconds", nil).Set(float64(m.PauseTotalNs))
	
	// Goroutine metrics
	sm.collector.NewGauge("goroutines_count", "Number of goroutines", nil).Set(float64(runtime.NumGoroutine()))
}

// StartSystemMetricsCollection starts collecting system metrics periodically
func (sm *SystemMetrics) StartSystemMetricsCollection(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sm.CollectSystemMetrics()
		}
	}
}

// Global metrics collector
var globalMetricsCollector *MetricsCollector
var once sync.Once

// GetGlobalMetricsCollector returns the global metrics collector
func GetGlobalMetricsCollector() *MetricsCollector {
	once.Do(func() {
		globalMetricsCollector = NewMetricsCollector()
	})
	return globalMetricsCollector
}

// Convenience functions for global metrics
func IncrementRequests(method, path string, statusCode int) {
	GetGlobalMetricsCollector().IncrementRequests(method, path, statusCode)
}

func ObserveRequestDuration(method, path string, duration time.Duration) {
	GetGlobalMetricsCollector().ObserveRequestDuration(method, path, duration)
}

func IncrementErrors(errorType, component string) {
	GetGlobalMetricsCollector().IncrementErrors(errorType, component)
}

func SetActiveConnections(count int) {
	GetGlobalMetricsCollector().SetActiveConnections(count)
}

func SetActiveGameSessions(count int) {
	GetGlobalMetricsCollector().SetActiveGameSessions(count)
}

func SetActivePlayers(count int) {
	GetGlobalMetricsCollector().SetActivePlayers(count)
}