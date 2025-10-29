from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class Theme(str, Enum):
    GENERAL = "general"  # Default theme for now
    WORKPLACE = "workplace"  # Future expansion
    SOCIAL = "social"  # Future expansion
    ADVENTURE = "adventure"  # Future expansion
    MYSTERY = "mystery"  # Future expansion
    COMEDY = "comedy"  # Future expansion
    SURVIVAL = "survival"  # Future expansion

class Door(BaseModel):
    """Door scenario model"""
    door_id: str = Field(..., description="Unique identifier for the door")
    content: str = Field(..., description="The door scenario text")
    theme: Theme = Field(default=Theme.GENERAL, description="Theme category of the door")
    difficulty: Optional[DifficultyLevel] = Field(default=None, description="Difficulty level (optional)")
    expected_solution_types: List[str] = Field(default_factory=list, description="Types of solutions expected")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context for the door")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DoorRequest(BaseModel):
    """Request model for door generation"""
    theme: Theme = Field(default=Theme.GENERAL, description="Theme for the door")
    difficulty: Optional[DifficultyLevel] = Field(default=None, description="Difficulty level (optional, not used currently)")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context for generation")

class ScoringMetrics(BaseModel):
    """Individual scoring metrics"""
    creativity: float = Field(..., ge=0, le=100, description="Creativity score (0-100)")
    feasibility: float = Field(..., ge=0, le=100, description="Feasibility score (0-100)")
    originality: float = Field(..., ge=0, le=100, description="Originality score (0-100)")

class ScoringResult(BaseModel):
    """Simplified result model for response scoring"""
    response_id: str = Field(..., description="Unique identifier for the response")
    total_score: float = Field(..., ge=0, le=100, description="Overall score (0-100)")
    metrics: ScoringMetrics = Field(..., description="Detailed scoring metrics")
    exaggerated_outcome: str = Field(..., description="Dramatic, entertaining outcome based on the user's response")
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

# New models for curated scenarios and enhanced evaluation

class CuratedScenario(BaseModel):
    """Curated scenario model with expected answers"""
    scenario_id: str = Field(..., description="Unique identifier for the scenario")
    content: str = Field(..., description="The scenario text")
    theme: Theme = Field(default=Theme.GENERAL, description="Theme category of the scenario")
    difficulty: Optional[DifficultyLevel] = Field(default=None, description="Difficulty level (optional, all scenarios same difficulty for now)")
    expected_answer: str = Field(..., description="Expected optimal answer")
    reasoning_criteria: List[str] = Field(default_factory=list, description="Key reasoning points expected")
    key_concepts: List[str] = Field(default_factory=list, description="Important concepts to identify")
    scoring_weight: float = Field(default=1.0, description="Weight for scoring this scenario")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ExpectedAnswer(BaseModel):
    """Expected answer model for structured comparison"""
    answer_text: str = Field(..., description="The expected answer text")
    reasoning_points: List[str] = Field(..., description="Key reasoning points")
    key_concepts: List[str] = Field(..., description="Important concepts")
    scoring_weight: float = Field(default=1.0, ge=0, le=2, description="Weight for scoring (0-2)")

class ResponseEvaluationRequest(BaseModel):
    """Request model for response evaluation"""
    scenario_id: str = Field(..., description="ID of the scenario being evaluated")
    player_response: str = Field(..., max_length=1000, description="Player's response to evaluate")
    session_id: Optional[str] = Field(default=None, description="Session identifier")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context")

class EvaluationWithOutcomeResponse(BaseModel):
    """Enhanced response model with outcomes and path recommendations"""
    response_id: str = Field(..., description="Unique identifier for the response")
    scenario_id: str = Field(..., description="ID of the evaluated scenario")
    total_score: float = Field(..., ge=0, le=100, description="Overall score (0-100)")
    comparison_score: float = Field(..., ge=0, le=100, description="Answer comparison score")
    reasoning_score: float = Field(..., ge=0, le=100, description="Reasoning quality score")
    score_category: str = Field(..., description="Score category: poor, average, excellent")
    exaggerated_outcome: str = Field(..., description="Dramatic outcome based on score")
    path_recommendation: str = Field(..., description="Path difficulty: shorter, medium, longer")
    recommended_node_count: int = Field(..., ge=1, description="Recommended number of nodes")
    detailed_feedback: str = Field(..., description="Detailed feedback on the response")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")

class CuratedScenarioResponse(BaseModel):
    """Response model for curated scenario retrieval"""
    scenario_id: str = Field(..., description="Unique identifier for the scenario")
    content: str = Field(..., description="The scenario text")
    theme: Theme = Field(default=Theme.GENERAL, description="Theme category")
    difficulty: Optional[DifficultyLevel] = Field(default=None, description="Difficulty level (optional)")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context")

class ScoreCategory(str, Enum):
    """Score category enumeration"""
    POOR = "poor"
    AVERAGE = "average"
    EXCELLENT = "excellent"

class PathDifficulty(str, Enum):
    """Path difficulty enumeration"""
    SHORTER = "shorter"
    MEDIUM = "medium"
    LONGER = "longer"