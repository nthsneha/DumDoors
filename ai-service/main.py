from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import logging
from dotenv import load_dotenv

from services.ai_client import AIClient
from services.door_service import DoorService
from services.scoring_service import ScoringService
from models.door import Door, DoorRequest, ScoringResult, ScoringRequest

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DumDoors AI Service",
    description="AI service for door generation and response scoring",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    """Health check endpoint for service monitoring"""
    try:
        # Test AI client connection
        ai_status = await ai_client.health_check()
        return {
            "status": "ok",
            "service": "dumdoors-ai-service",
            "version": "1.0.0",
            "ai_client": ai_status
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.post("/doors/generate", response_model=Door)
async def generate_door(request: DoorRequest):
    """Generate a new door scenario based on theme and difficulty"""
    try:
        door = await door_service.generate_door(
            theme=request.theme,
            difficulty=request.difficulty,
            context=request.context
        )
        return door
    except Exception as e:
        logger.error(f"Door generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate door")

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
    """Score a player's response to a door scenario"""
    try:
        result = await scoring_service.score_response(
            door_content=request.door_content,
            response=request.response,
            context=request.context
        )
        return result
    except Exception as e:
        logger.error(f"Response scoring failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to score response")

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