import logging
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""
    
    def __init__(self, service_name: str = "dumdoors-ai-service", version: str = "1.0.0"):
        super().__init__()
        self.service_name = service_name
        self.version = version
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON"""
        
        # Base log entry
        log_entry = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "service": self.service_name,
            "version": self.version,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception information if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info) if record.exc_info else None
            }
        
        # Add extra fields from record
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
                'module', 'exc_info', 'exc_text', 'stack_info', 'lineno', 'funcName',
                'created', 'msecs', 'relativeCreated', 'thread', 'threadName',
                'processName', 'process', 'getMessage'
            }:
                extra_fields[key] = value
        
        if extra_fields:
            log_entry["fields"] = extra_fields
        
        return json.dumps(log_entry, default=str)

class ContextFilter(logging.Filter):
    """Filter to add context information to log records"""
    
    def __init__(self):
        super().__init__()
        self.context = {}
    
    def set_context(self, **kwargs):
        """Set context information"""
        self.context.update(kwargs)
    
    def clear_context(self):
        """Clear context information"""
        self.context.clear()
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add context to log record"""
        for key, value in self.context.items():
            setattr(record, key, value)
        return True

# Global context filter instance
context_filter = ContextFilter()

def setup_logging(
    service_name: str = "dumdoors-ai-service",
    version: str = "1.0.0",
    log_level: str = "INFO",
    enable_console: bool = True,
    enable_file: bool = False,
    log_file: Optional[str] = None
):
    """Setup structured logging configuration"""
    
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Create formatter
    formatter = StructuredFormatter(service_name, version)
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.addFilter(context_filter)
        root_logger.addHandler(console_handler)
    
    # File handler
    if enable_file and log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(context_filter)
        root_logger.addHandler(file_handler)
    
    # Set specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    return root_logger

def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name"""
    return logging.getLogger(name)

def set_request_context(request_id: str, operation: Optional[str] = None, **kwargs):
    """Set request context for logging"""
    context = {
        "request_id": request_id,
        **kwargs
    }
    if operation:
        context["operation"] = operation
    
    context_filter.set_context(**context)

def clear_request_context():
    """Clear request context"""
    context_filter.clear_context()

class LoggerMixin:
    """Mixin class to add logging capabilities to other classes"""
    
    @property
    def logger(self) -> logging.Logger:
        """Get logger for this class"""
        return logging.getLogger(self.__class__.__name__)
    
    def log_operation(self, operation: str, **kwargs):
        """Log the start of an operation"""
        self.logger.info(f"Starting operation: {operation}", extra=kwargs)
    
    def log_success(self, operation: str, duration: Optional[float] = None, **kwargs):
        """Log successful operation completion"""
        extra = {"success": True, **kwargs}
        if duration is not None:
            extra["duration_ms"] = round(duration * 1000, 2)
        
        self.logger.info(f"Operation completed successfully: {operation}", extra=extra)
    
    def log_error(self, operation: str, error: Exception, duration: Optional[float] = None, **kwargs):
        """Log operation error"""
        extra = {
            "success": False,
            "error_type": type(error).__name__,
            **kwargs
        }
        if duration is not None:
            extra["duration_ms"] = round(duration * 1000, 2)
        
        self.logger.error(f"Operation failed: {operation}", exc_info=error, extra=extra)

class PerformanceLogger:
    """Logger for performance monitoring"""
    
    def __init__(self, logger_name: str = "performance"):
        self.logger = logging.getLogger(logger_name)
    
    def log_request_metrics(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration: float,
        request_size: Optional[int] = None,
        response_size: Optional[int] = None,
        **kwargs
    ):
        """Log HTTP request metrics"""
        metrics = {
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "duration_ms": round(duration * 1000, 2),
            "success": 200 <= status_code < 400,
            **kwargs
        }
        
        if request_size is not None:
            metrics["request_size_bytes"] = request_size
        
        if response_size is not None:
            metrics["response_size_bytes"] = response_size
        
        self.logger.info("HTTP request processed", extra=metrics)
    
    def log_ai_operation_metrics(
        self,
        operation: str,
        provider: str,
        model: str,
        duration: float,
        success: bool,
        tokens_used: Optional[int] = None,
        **kwargs
    ):
        """Log AI operation metrics"""
        metrics = {
            "operation": operation,
            "provider": provider,
            "model": model,
            "duration_ms": round(duration * 1000, 2),
            "success": success,
            **kwargs
        }
        
        if tokens_used is not None:
            metrics["tokens_used"] = tokens_used
        
        self.logger.info("AI operation completed", extra=metrics)
    
    def log_database_metrics(
        self,
        operation: str,
        collection: str,
        duration: float,
        success: bool,
        records_affected: Optional[int] = None,
        **kwargs
    ):
        """Log database operation metrics"""
        metrics = {
            "operation": operation,
            "collection": collection,
            "duration_ms": round(duration * 1000, 2),
            "success": success,
            **kwargs
        }
        
        if records_affected is not None:
            metrics["records_affected"] = records_affected
        
        self.logger.info("Database operation completed", extra=metrics)

# Global performance logger instance
performance_logger = PerformanceLogger()

def log_request_metrics(*args, **kwargs):
    """Convenience function for logging request metrics"""
    performance_logger.log_request_metrics(*args, **kwargs)

def log_ai_operation_metrics(*args, **kwargs):
    """Convenience function for logging AI operation metrics"""
    performance_logger.log_ai_operation_metrics(*args, **kwargs)

def log_database_metrics(*args, **kwargs):
    """Convenience function for logging database metrics"""
    performance_logger.log_database_metrics(*args, **kwargs)

# Context manager for operation logging
class LoggedOperation:
    """Context manager for logging operations with timing"""
    
    def __init__(self, logger: logging.Logger, operation: str, **kwargs):
        self.logger = logger
        self.operation = operation
        self.kwargs = kwargs
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        self.logger.info(f"Starting operation: {self.operation}", extra=self.kwargs)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time if self.start_time else 0
        
        if exc_type is None:
            # Success
            extra = {"success": True, "duration_ms": round(duration * 1000, 2), **self.kwargs}
            self.logger.info(f"Operation completed successfully: {self.operation}", extra=extra)
        else:
            # Error
            extra = {
                "success": False,
                "duration_ms": round(duration * 1000, 2),
                "error_type": exc_type.__name__ if exc_type else "Unknown",
                **self.kwargs
            }
            self.logger.error(f"Operation failed: {self.operation}", exc_info=exc_val, extra=extra)
        
        return False  # Don't suppress exceptions

def logged_operation(logger: logging.Logger, operation: str, **kwargs):
    """Create a logged operation context manager"""
    return LoggedOperation(logger, operation, **kwargs)