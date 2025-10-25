from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class Theme(str, Enum):
    WORKPLACE = "workplace"
    SOCIAL = "social"
    ADVENTURE = "adventure"
    MYSTERY = "mystery"
    COMEDY = "comedy"
    SURVIVAL = "survival"
    RANDOM = "random"

class Door(BaseModel):
    """Door scenario model"""
    door_id: str = Field(..., description="Unique identifier for the door")
    content: str = Field(..., description="The door scenario text")
    theme: Theme = Field(..., description="Theme category of the door")
    difficulty: DifficultyLevel = Field(..., description="Difficulty level")
    expected_solution_types: List[str] = Field(default_factory=list, description="Types of solutions expected")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context for the door")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DoorRequest(BaseModel):
    """Request model for door generation"""
    theme: Theme = Field(..., description="Theme for the door")
    difficulty: DifficultyLevel = Field(..., description="Difficulty level")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context for generation")

class ScoringMetrics(BaseModel):
    """Individual scoring metrics"""
    creativity: float = Field(..., ge=0, le=100, description="Creativity score (0-100)")
    feasibility: float = Field(..., ge=0, le=100, description="Feasibility score (0-100)")
    humor: float = Field(..., ge=0, le=100, description="Humor score (0-100)")
    originality: float = Field(..., ge=0, le=100, description="Originality score (0-100)")

class ScoringResult(BaseModel):
    """Result model for response scoring"""
    response_id: str = Field(..., description="Unique identifier for the response")
    total_score: float = Field(..., ge=0, le=100, description="Overall score (0-100)")
    metrics: ScoringMetrics = Field(..., description="Detailed scoring metrics")
    feedback: Optional[str] = Field(default=None, description="AI feedback on the response")
    path_recommendation: str = Field(..., description="Recommended path based on score")
    processing_time_ms: float = Field(..., description="Time taken to process the scoring")

class ScoringRequest(BaseModel):
    """Request model for response scoring"""
    response_id: str = Field(..., description="Unique identifier for the response")
    door_content: str = Field(..., description="The door scenario that was presented")
    response: str = Field(..., max_length=500, description="Player's response to the door")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context for scoring")

class AIClientConfig(BaseModel):
    """Configuration for AI client"""
    provider: str = Field(..., description="AI provider (openai, anthropic, etc.)")
    api_key: str = Field(..., description="API key for the provider")
    model: str = Field(..., description="Model to use for generation/scoring")
    max_tokens: int = Field(default=1000, description="Maximum tokens for responses")
    temperature: float = Field(default=0.7, ge=0, le=2, description="Temperature for generation")

class CacheStats(BaseModel):
    """Cache statistics model"""
    total_doors: int = Field(..., description="Total doors in cache")
    cache_hits: int = Field(..., description="Number of cache hits")
    cache_misses: int = Field(..., description="Number of cache misses")
    hit_rate: float = Field(..., description="Cache hit rate percentage")
    memory_usage_mb: float = Field(..., description="Memory usage in MB")