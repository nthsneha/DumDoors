import logging
import traceback
import time
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for comprehensive error handling in the AI service"""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        request_id = request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")
        
        try:
            # Add request ID to request state
            request.state.request_id = request_id
            
            # Process request
            response = await call_next(request)
            
            # Add request ID to response headers
            response.headers["x-request-id"] = request_id
            
            # Log successful requests
            process_time = time.time() - start_time
            logger.info(
                f"REQUEST_SUCCESS: {request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time:.3f}s - "
                f"RequestID: {request_id}"
            )
            
            return response
            
        except HTTPException as e:
            # Handle HTTP exceptions
            return await self._handle_http_exception(request, e, request_id, start_time)
            
        except Exception as e:
            # Handle unexpected exceptions
            return await self._handle_unexpected_exception(request, e, request_id, start_time)
    
    async def _handle_http_exception(
        self, 
        request: Request, 
        exc: HTTPException, 
        request_id: str, 
        start_time: float
    ) -> JSONResponse:
        """Handle HTTP exceptions with proper logging and response formatting"""
        
        process_time = time.time() - start_time
        
        error_response = {
            "error": True,
            "type": self._get_error_type(exc.status_code),
            "message": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id,
            "timestamp": time.time(),
            "path": str(request.url.path),
            "method": request.method
        }
        
        # Log based on severity
        if exc.status_code >= 500:
            logger.error(
                f"HTTP_ERROR_SERVER: {request.method} {request.url.path} - "
                f"Status: {exc.status_code} - "
                f"Message: {exc.detail} - "
                f"Time: {process_time:.3f}s - "
                f"RequestID: {request_id}"
            )
        elif exc.status_code >= 400:
            logger.warning(
                f"HTTP_ERROR_CLIENT: {request.method} {request.url.path} - "
                f"Status: {exc.status_code} - "
                f"Message: {exc.detail} - "
                f"Time: {process_time:.3f}s - "
                f"RequestID: {request_id}"
            )
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response,
            headers={"x-request-id": request_id}
        )
    
    async def _handle_unexpected_exception(
        self, 
        request: Request, 
        exc: Exception, 
        request_id: str, 
        start_time: float
    ) -> JSONResponse:
        """Handle unexpected exceptions with proper logging and response formatting"""
        
        process_time = time.time() - start_time
        error_trace = traceback.format_exc()
        
        error_response = {
            "error": True,
            "type": "internal_server_error",
            "message": "An unexpected error occurred",
            "status_code": 500,
            "request_id": request_id,
            "timestamp": time.time(),
            "path": str(request.url.path),
            "method": request.method
        }
        
        # Log the full error with stack trace
        logger.error(
            f"UNEXPECTED_ERROR: {request.method} {request.url.path} - "
            f"Error: {str(exc)} - "
            f"Time: {process_time:.3f}s - "
            f"RequestID: {request_id} - "
            f"Trace: {error_trace}"
        )
        
        return JSONResponse(
            status_code=500,
            content=error_response,
            headers={"x-request-id": request_id}
        )
    
    def _get_error_type(self, status_code: int) -> str:
        """Get error type based on HTTP status code"""
        if status_code == 400:
            return "bad_request"
        elif status_code == 401:
            return "unauthorized"
        elif status_code == 403:
            return "forbidden"
        elif status_code == 404:
            return "not_found"
        elif status_code == 409:
            return "conflict"
        elif status_code == 422:
            return "validation_error"
        elif status_code == 429:
            return "rate_limit_exceeded"
        elif status_code == 500:
            return "internal_server_error"
        elif status_code == 502:
            return "bad_gateway"
        elif status_code == 503:
            return "service_unavailable"
        elif status_code == 504:
            return "gateway_timeout"
        else:
            return "unknown_error"

class CircuitBreakerError(Exception):
    """Exception raised when circuit breaker is open"""
    def __init__(self, service_name: str, message: str = None):
        self.service_name = service_name
        self.message = message or f"Circuit breaker is open for service: {service_name}"
        super().__init__(self.message)

class CircuitBreaker:
    """Simple circuit breaker implementation for AI service calls"""
    
    def __init__(self, 
                 failure_threshold: int = 5, 
                 recovery_timeout: int = 60, 
                 expected_exception: type = Exception):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    def __call__(self, func):
        """Decorator to wrap functions with circuit breaker"""
        async def wrapper(*args, **kwargs):
            if self.state == "open":
                if self._should_attempt_reset():
                    self.state = "half-open"
                else:
                    raise CircuitBreakerError(func.__name__)
            
            try:
                result = await func(*args, **kwargs)
                self._on_success()
                return result
            except self.expected_exception as e:
                self._on_failure()
                raise e
        
        return wrapper
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True
        return time.time() - self.last_failure_time >= self.recovery_timeout
    
    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0
        self.state = "closed"
    
    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
    
    def get_state(self) -> Dict[str, Any]:
        """Get current circuit breaker state"""
        return {
            "state": self.state,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self.last_failure_time,
            "recovery_timeout": self.recovery_timeout
        }

# Global circuit breakers for different services
ai_provider_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=30,
    expected_exception=Exception
)

class RetryConfig:
    """Configuration for retry logic"""
    def __init__(self, 
                 max_attempts: int = 3, 
                 base_delay: float = 1.0, 
                 max_delay: float = 60.0, 
                 exponential_base: float = 2.0):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base

async def retry_with_backoff(func, config: RetryConfig, *args, **kwargs):
    """Retry function with exponential backoff"""
    last_exception = None
    
    for attempt in range(config.max_attempts):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            
            if attempt == config.max_attempts - 1:
                # Last attempt, don't wait
                break
            
            # Calculate delay with exponential backoff
            delay = min(
                config.base_delay * (config.exponential_base ** attempt),
                config.max_delay
            )
            
            logger.warning(
                f"Attempt {attempt + 1} failed for {func.__name__}: {str(e)}. "
                f"Retrying in {delay:.2f} seconds..."
            )
            
            await asyncio.sleep(delay)
    
    # All attempts failed
    raise last_exception

def create_error_response(
    message: str, 
    error_type: str = "internal_error", 
    status_code: int = 500, 
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create standardized error response"""
    return {
        "error": True,
        "type": error_type,
        "message": message,
        "status_code": status_code,
        "details": details or {},
        "timestamp": time.time()
    }

# Import asyncio for retry functionality
import asyncio