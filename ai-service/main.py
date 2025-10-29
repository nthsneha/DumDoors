from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import os
import logging
import time
from dotenv import load_dotenv

from middleware.error_handler import ErrorHandlingMiddleware, CircuitBreakerError, create_error_response
from logging_config import set_request_context, clear_request_context, log_request_metrics
from services.ai_client import AIClient
from services.door_service import DoorService
from services.scoring_service import ScoringService
from models.door import Door, DoorRequest, ScoringResult, ScoringRequest

# Load environment variables
load_dotenv()

# Configure structured logging
from logging_config import setup_logging, get_logger, set_request_context, clear_request_context, log_request_metrics

# Setup logging based on environment
log_level = os.getenv("LOG_LEVEL", "INFO")
setup_logging(
    service_name="dumdoors-ai-service",
    version="1.0.0",
    log_level=log_level,
    enable_console=True,
    enable_file=False
)

logger = get_logger(__name__)

app = FastAPI(
    title="DumDoors AI Service",
    description="AI service for door generation and response scoring with comprehensive error handling",
    version="1.0.0"
)

# Request logging middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")
    
    # Set request context for logging
    set_request_context(request_id, operation=f"{request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log request metrics
        log_request_metrics(
            endpoint=str(request.url.path),
            method=request.method,
            status_code=response.status_code,
            duration=duration,
            request_id=request_id
        )
        
        # Add request ID to response
        response.headers["x-request-id"] = request_id
        
        return response
    
    finally:
        # Clear request context
        clear_request_context()

# Add error handling middleware
app.add_middleware(ErrorHandlingMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler for circuit breaker errors
@app.exception_handler(CircuitBreakerError)
async def circuit_breaker_exception_handler(request: Request, exc: CircuitBreakerError):
    return JSONResponse(
        status_code=503,
        content=create_error_response(
            message=exc.message,
            error_type="service_unavailable",
            status_code=503,
            details={"service": exc.service_name, "reason": "circuit_breaker_open"}
        )
    )

# Initialize services
ai_client = AIClient()
door_service = DoorService(ai_client)
scoring_service = ScoringService(ai_client)

@app.get("/")
async def root():
    return {"message": "DumDoors AI Service", "status": "running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint for service monitoring"""
    try:
        start_time = time.time()
        
        # Test AI client connection
        ai_status = await ai_client.health_check()
        
        # Check service dependencies
        health_response = {
            "status": "healthy",
            "service": "dumdoors-ai-service",
            "version": "1.0.0",
            "timestamp": time.time(),
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "checks": {
                "ai_client": ai_status,
                "memory": "ok",  # Could add actual memory check
                "disk": "ok",    # Could add actual disk check
            }
        }
        
        # Determine overall health
        if ai_status.get("overall_status") != "healthy":
            health_response["status"] = "degraded"
            return JSONResponse(
                status_code=200,  # Still return 200 for degraded but functional
                content=health_response
            )
        
        return health_response
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        error_response = create_error_response(
            message="Health check failed",
            error_type="service_unhealthy",
            status_code=503,
            details={"error": str(e)}
        )
        return JSONResponse(status_code=503, content=error_response)

@app.get("/health/ready")
async def readiness_check():
    """Readiness check for Kubernetes readiness probes"""
    try:
        # Quick check to see if service can handle requests
        ai_status = await ai_client.health_check()
        
        if ai_status.get("overall_status") == "healthy":
            return {"status": "ready", "timestamp": time.time()}
        else:
            return JSONResponse(
                status_code=503,
                content=create_error_response(
                    message="Service not ready",
                    error_type="not_ready",
                    status_code=503
                )
            )
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content=create_error_response(
                message="Readiness check failed",
                error_type="not_ready",
                status_code=503,
                details={"error": str(e)}
            )
        )

@app.get("/health/live")
async def liveness_check():
    """Liveness check for Kubernetes liveness probes"""
    return {
        "status": "alive",
        "service": "dumdoors-ai-service",
        "timestamp": time.time()
    }

@app.post("/doors/generate", response_model=Door)
async def generate_door(request: DoorRequest):
    """Generate a new door scenario based on theme and difficulty with enhanced error handling"""
    try:
        # Validate request
        if not request.theme:
            raise HTTPException(
                status_code=400, 
                detail="Theme is required for door generation"
            )
        
        if request.difficulty < 1 or request.difficulty > 3:
            raise HTTPException(
                status_code=400,
                detail="Difficulty must be between 1 and 3"
            )
        
        door = await door_service.generate_door(
            theme=request.theme,
            difficulty=request.difficulty,
            context=request.context
        )
        
        logger.info(f"Door generated successfully: theme={request.theme}, difficulty={request.difficulty}")
        return door
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except CircuitBreakerError as e:
        logger.warning(f"Circuit breaker open for door generation: {e}")
        raise HTTPException(
            status_code=503,
            detail="Door generation service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Door generation failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to generate door due to internal error"
        )

@app.post("/doors/themed", response_model=List[Door])
async def get_themed_doors(theme: str, count: int = 5):
    """Get multiple doors for a specific theme"""
    try:
        doors = await door_service.get_themed_doors(theme, count)
        return doors
    except Exception as e:
        logger.error(f"Themed doors retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve themed doors")

@app.post("/scoring/score-response", response_model=ScoringResult)
async def score_response(request: ScoringRequest):
    """Score a player's response to a door scenario with enhanced error handling"""
    try:
        # Validate request
        if not request.door_content:
            raise HTTPException(
                status_code=400,
                detail="Door content is required for scoring"
            )
        
        if not request.response:
            raise HTTPException(
                status_code=400,
                detail="Player response is required for scoring"
            )
        
        if len(request.response) > 500:
            raise HTTPException(
                status_code=400,
                detail="Response exceeds maximum length of 500 characters"
            )
        
        result = await scoring_service.score_response(
            door_content=request.door_content,
            response=request.response,
            context=request.context
        )
        
        logger.info(f"Response scored successfully: score={result.total}")
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except CircuitBreakerError as e:
        logger.warning(f"Circuit breaker open for response scoring: {e}")
        raise HTTPException(
            status_code=503,
            detail="Response scoring service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Response scoring failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to score response due to internal error"
        )

@app.post("/scoring/batch-score", response_model=List[ScoringResult])
async def batch_score_responses(requests: List[ScoringRequest]):
    """Score multiple player responses in batch"""
    try:
        results = await scoring_service.batch_score_responses(requests)
        return results
    except Exception as e:
        logger.error(f"Batch scoring failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to score responses")

@app.get("/doors/cache-stats")
async def get_cache_stats():
    """Get door cache statistics for monitoring"""
    try:
        stats = await door_service.get_cache_stats()
        return stats
    except Exception as e:
        logger.error(f"Cache stats retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cache stats")

@app.post("/path/next-door")
async def get_next_door_for_player(player_id: str, current_door_id: str, latest_score: float):
    """Get the next door for a player based on their score and current position"""
    try:
        next_door = await scoring_service.get_next_door_for_player(player_id, current_door_id, latest_score)
        if next_door:
            return next_door
        else:
            raise HTTPException(status_code=404, detail="No next door found")
    except Exception as e:
        logger.error(f"Next door retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get next door")

@app.get("/path/progress/{player_id}")
async def get_player_progress(player_id: str):
    """Get comprehensive player progress information"""
    try:
        progress = await scoring_service.calculate_player_progress(player_id)
        return progress
    except Exception as e:
        logger.error(f"Player progress calculation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate player progress")

@app.post("/path/initialize")
async def initialize_player_journey(player_id: str, theme: str, difficulty: str):
    """Initialize a new player's journey in the game"""
    try:
        result = await scoring_service.initialize_player_journey(player_id, theme, difficulty)
        return result
    except Exception as e:
        logger.error(f"Player journey initialization failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize player journey")

@app.get("/analytics/{player_id}")
async def get_player_analytics(player_id: str):
    """Get detailed scoring analytics for a player"""
    try:
        analytics = await scoring_service.get_scoring_analytics(player_id)
        return analytics
    except Exception as e:
        logger.error(f"Analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve player analytics")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)