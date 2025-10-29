package logging

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
	"time"
)

// LogLevel represents the severity level of a log entry
type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
	LevelFatal LogLevel = "fatal"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp   time.Time              `json:"timestamp"`
	Level       LogLevel               `json:"level"`
	Message     string                 `json:"message"`
	Service     string                 `json:"service"`
	Version     string                 `json:"version"`
	RequestID   string                 `json:"request_id,omitempty"`
	SessionID   string                 `json:"session_id,omitempty"`
	PlayerID    string                 `json:"player_id,omitempty"`
	Component   string                 `json:"component,omitempty"`
	Operation   string                 `json:"operation,omitempty"`
	Duration    *time.Duration         `json:"duration_ms,omitempty"`
	Error       string                 `json:"error,omitempty"`
	StackTrace  string                 `json:"stack_trace,omitempty"`
	Fields      map[string]interface{} `json:"fields,omitempty"`
	Caller      string                 `json:"caller,omitempty"`
}

// Logger provides structured logging functionality
type Logger struct {
	service     string
	version     string
	level       LogLevel
	output      *log.Logger
	enableCaller bool
}

// NewLogger creates a new structured logger
func NewLogger(service, version string) *Logger {
	return &Logger{
		service:      service,
		version:      version,
		level:        LevelInfo,
		output:       log.New(os.Stdout, "", 0),
		enableCaller: true,
	}
}

// SetLevel sets the minimum log level
func (l *Logger) SetLevel(level LogLevel) {
	l.level = level
}

// WithRequestID returns a logger with request ID context
func (l *Logger) WithRequestID(requestID string) *ContextLogger {
	return &ContextLogger{
		logger:    l,
		requestID: requestID,
	}
}

// WithSession returns a logger with session context
func (l *Logger) WithSession(sessionID string) *ContextLogger {
	return &ContextLogger{
		logger:    l,
		sessionID: sessionID,
	}
}

// WithPlayer returns a logger with player context
func (l *Logger) WithPlayer(playerID string) *ContextLogger {
	return &ContextLogger{
		logger:   l,
		playerID: playerID,
	}
}

// WithComponent returns a logger with component context
func (l *Logger) WithComponent(component string) *ContextLogger {
	return &ContextLogger{
		logger:    l,
		component: component,
	}
}

// WithFields returns a logger with additional fields
func (l *Logger) WithFields(fields map[string]interface{}) *ContextLogger {
	return &ContextLogger{
		logger: l,
		fields: fields,
	}
}

// Debug logs a debug message
func (l *Logger) Debug(message string) {
	l.log(LevelDebug, message, nil)
}

// Info logs an info message
func (l *Logger) Info(message string) {
	l.log(LevelInfo, message, nil)
}

// Warn logs a warning message
func (l *Logger) Warn(message string) {
	l.log(LevelWarn, message, nil)
}

// Error logs an error message
func (l *Logger) Error(message string, err error) {
	l.log(LevelError, message, err)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(message string, err error) {
	l.log(LevelFatal, message, err)
	os.Exit(1)
}

// log writes a log entry
func (l *Logger) log(level LogLevel, message string, err error) {
	if !l.shouldLog(level) {
		return
	}

	entry := LogEntry{
		Timestamp: time.Now().UTC(),
		Level:     level,
		Message:   message,
		Service:   l.service,
		Version:   l.version,
	}

	if err != nil {
		entry.Error = err.Error()
		if level == LevelError || level == LevelFatal {
			entry.StackTrace = getStackTrace()
		}
	}

	if l.enableCaller {
		entry.Caller = getCaller()
	}

	l.writeEntry(entry)
}

// shouldLog checks if the log level should be logged
func (l *Logger) shouldLog(level LogLevel) bool {
	levels := map[LogLevel]int{
		LevelDebug: 0,
		LevelInfo:  1,
		LevelWarn:  2,
		LevelError: 3,
		LevelFatal: 4,
	}

	return levels[level] >= levels[l.level]
}

// writeEntry writes the log entry to output
func (l *Logger) writeEntry(entry LogEntry) {
	jsonBytes, err := json.Marshal(entry)
	if err != nil {
		// Fallback to simple logging if JSON marshaling fails
		l.output.Printf("LOG_MARSHAL_ERROR: %v - Original: %s", err, entry.Message)
		return
	}

	l.output.Println(string(jsonBytes))
}

// ContextLogger provides logging with additional context
type ContextLogger struct {
	logger    *Logger
	requestID string
	sessionID string
	playerID  string
	component string
	operation string
	fields    map[string]interface{}
}

// WithRequestID adds request ID to context
func (cl *ContextLogger) WithRequestID(requestID string) *ContextLogger {
	newLogger := *cl
	newLogger.requestID = requestID
	return &newLogger
}

// WithSession adds session ID to context
func (cl *ContextLogger) WithSession(sessionID string) *ContextLogger {
	newLogger := *cl
	newLogger.sessionID = sessionID
	return &newLogger
}

// WithPlayer adds player ID to context
func (cl *ContextLogger) WithPlayer(playerID string) *ContextLogger {
	newLogger := *cl
	newLogger.playerID = playerID
	return &newLogger
}

// WithComponent adds component to context
func (cl *ContextLogger) WithComponent(component string) *ContextLogger {
	newLogger := *cl
	newLogger.component = component
	return &newLogger
}

// WithOperation adds operation to context
func (cl *ContextLogger) WithOperation(operation string) *ContextLogger {
	newLogger := *cl
	newLogger.operation = operation
	return &newLogger
}

// WithFields adds fields to context
func (cl *ContextLogger) WithFields(fields map[string]interface{}) *ContextLogger {
	newLogger := *cl
	if newLogger.fields == nil {
		newLogger.fields = make(map[string]interface{})
	}
	for k, v := range fields {
		newLogger.fields[k] = v
	}
	return &newLogger
}

// Debug logs a debug message with context
func (cl *ContextLogger) Debug(message string) {
	cl.log(LevelDebug, message, nil)
}

// Info logs an info message with context
func (cl *ContextLogger) Info(message string) {
	cl.log(LevelInfo, message, nil)
}

// Warn logs a warning message with context
func (cl *ContextLogger) Warn(message string) {
	cl.log(LevelWarn, message, nil)
}

// Error logs an error message with context
func (cl *ContextLogger) Error(message string, err error) {
	cl.log(LevelError, message, err)
}

// Fatal logs a fatal message with context and exits
func (cl *ContextLogger) Fatal(message string, err error) {
	cl.log(LevelFatal, message, err)
	os.Exit(1)
}

// LogOperation logs the start and completion of an operation
func (cl *ContextLogger) LogOperation(operation string, fn func() error) error {
	start := time.Now()
	opLogger := cl.WithOperation(operation)
	
	opLogger.Info(fmt.Sprintf("Starting operation: %s", operation))
	
	err := fn()
	duration := time.Since(start)
	
	if err != nil {
		opLogger.WithFields(map[string]interface{}{
			"duration_ms": duration.Milliseconds(),
			"success":     false,
		}).Error(fmt.Sprintf("Operation failed: %s", operation), err)
	} else {
		opLogger.WithFields(map[string]interface{}{
			"duration_ms": duration.Milliseconds(),
			"success":     true,
		}).Info(fmt.Sprintf("Operation completed: %s", operation))
	}
	
	return err
}

// log writes a log entry with context
func (cl *ContextLogger) log(level LogLevel, message string, err error) {
	if !cl.logger.shouldLog(level) {
		return
	}

	entry := LogEntry{
		Timestamp: time.Now().UTC(),
		Level:     level,
		Message:   message,
		Service:   cl.logger.service,
		Version:   cl.logger.version,
		RequestID: cl.requestID,
		SessionID: cl.sessionID,
		PlayerID:  cl.playerID,
		Component: cl.component,
		Operation: cl.operation,
		Fields:    cl.fields,
	}

	if err != nil {
		entry.Error = err.Error()
		if level == LevelError || level == LevelFatal {
			entry.StackTrace = getStackTrace()
		}
	}

	if cl.logger.enableCaller {
		entry.Caller = getCaller()
	}

	cl.logger.writeEntry(entry)
}

// getCaller returns the caller information
func getCaller() string {
	_, file, line, ok := runtime.Caller(4) // Skip log function calls
	if !ok {
		return "unknown"
	}
	
	// Get just the filename, not the full path
	parts := strings.Split(file, "/")
	filename := parts[len(parts)-1]
	
	return fmt.Sprintf("%s:%d", filename, line)
}

// getStackTrace returns the current stack trace
func getStackTrace() string {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	return string(buf[:n])
}

// Global logger instance
var defaultLogger *Logger

// InitializeLogger initializes the global logger
func InitializeLogger(service, version string, level LogLevel) {
	defaultLogger = NewLogger(service, version)
	defaultLogger.SetLevel(level)
}

// GetLogger returns the global logger
func GetLogger() *Logger {
	if defaultLogger == nil {
		defaultLogger = NewLogger("unknown", "unknown")
	}
	return defaultLogger
}

// Convenience functions for global logger
func Debug(message string) {
	GetLogger().Debug(message)
}

func Info(message string) {
	GetLogger().Info(message)
}

func Warn(message string) {
	GetLogger().Warn(message)
}

func Error(message string, err error) {
	GetLogger().Error(message, err)
}

func Fatal(message string, err error) {
	GetLogger().Fatal(message, err)
}

// WithContext creates a logger from context
func WithContext(ctx context.Context) *ContextLogger {
	logger := GetLogger()
	contextLogger := &ContextLogger{logger: logger}
	
	// Extract context values if they exist
	if requestID, ok := ctx.Value("request_id").(string); ok {
		contextLogger.requestID = requestID
	}
	if sessionID, ok := ctx.Value("session_id").(string); ok {
		contextLogger.sessionID = sessionID
	}
	if playerID, ok := ctx.Value("player_id").(string); ok {
		contextLogger.playerID = playerID
	}
	
	return contextLogger
}