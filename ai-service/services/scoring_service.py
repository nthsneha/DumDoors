import asyncio
import logging
import time
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from models.door import ScoringResult, ScoringRequest, ScoringMetrics
from services.ai_client import AIClient
from services.neo4j_service import Neo4jService

logger = logging.getLogger(__name__)

class ScoringService:
    """Service for scoring player responses"""
    
    def __init__(self, ai_client: AIClient):
        self.ai_client = ai_client
        self.neo4j_service = Neo4jService()
    
    async def score_response(self, door_content: str, response: str, context: Optional[Dict[str, Any]] = None) -> ScoringResult:
        """Score a single player response"""
        start_time = time.time()
        
        try:
            # Get AI scoring
            scores = await self.ai_client.score_response(door_content, response, context)
            
            # Create scoring metrics
            metrics = ScoringMetrics(
                creativity=scores.get('creativity', 50.0),
                feasibility=scores.get('feasibility', 50.0),
                humor=scores.get('humor', 50.0),
                originality=scores.get('originality', 50.0)
            )
            
            # Calculate total score (average of all metrics)
            total_score = (metrics.creativity + metrics.feasibility + metrics.humor + metrics.originality) / 4
            
            # Determine path recommendation based on score
            path_recommendation = self._get_path_recommendation(total_score)
            
            # Generate feedback (optional)
            feedback = await self._generate_feedback(door_content, response, metrics)
            
            processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            return ScoringResult(
                response_id=str(uuid.uuid4()),
                total_score=total_score,
                metrics=metrics,
                feedback=feedback,
                path_recommendation=path_recommendation,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            logger.error(f"Response scoring failed: {e}")
            raise
    
    async def batch_score_responses(self, requests: List[ScoringRequest]) -> List[ScoringResult]:
        """Score multiple responses in batch"""
        try:
            # Process all requests concurrently
            tasks = []
            for request in requests:
                task = self.score_response(
                    door_content=request.door_content,
                    response=request.response,
                    context=request.context
                )
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle any exceptions in the results
            final_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Batch scoring failed for request {i}: {result}")
                    # Create a default result for failed scoring
                    final_results.append(self._create_default_scoring_result(requests[i].response_id))
                else:
                    # Update response_id to match the request
                    result.response_id = requests[i].response_id
                    final_results.append(result)
            
            return final_results
            
        except Exception as e:
            logger.error(f"Batch scoring failed: {e}")
            raise
    
    def _get_path_recommendation(self, score: float) -> str:
        """Get path recommendation based on score"""
        if score >= 70:
            return "shorter_path"  # High score = fewer doors
        elif score <= 30:
            return "longer_path"   # Low score = more doors
        else:
            return "normal_path"   # Medium score = standard path
    
    async def _generate_feedback(self, door_content: str, response: str, metrics: ScoringMetrics) -> Optional[str]:
        """Generate AI feedback for the response (optional feature)"""
        try:
            # Simple feedback based on metrics
            feedback_parts = []
            
            if metrics.creativity >= 80:
                feedback_parts.append("Very creative solution!")
            elif metrics.creativity <= 30:
                feedback_parts.append("Try thinking more outside the box.")
            
            if metrics.feasibility >= 80:
                feedback_parts.append("Highly practical approach.")
            elif metrics.feasibility <= 30:
                feedback_parts.append("Consider the practicality of your solution.")
            
            if metrics.humor >= 70:
                feedback_parts.append("Great sense of humor!")
            
            if metrics.originality >= 80:
                feedback_parts.append("Unique and original thinking!")
            
            return " ".join(feedback_parts) if feedback_parts else None
            
        except Exception as e:
            logger.warning(f"Feedback generation failed: {e}")
            return None
    
    def _create_default_scoring_result(self, response_id: str) -> ScoringResult:
        """Create a default scoring result for failed scoring attempts"""
        default_metrics = ScoringMetrics(
            creativity=50.0,
            feasibility=50.0,
            humor=50.0,
            originality=50.0
        )
        
        return ScoringResult(
            response_id=response_id,
            total_score=50.0,
            metrics=default_metrics,
            feedback="Unable to generate detailed feedback at this time.",
            path_recommendation="normal_path",
            processing_time_ms=0.0
        )
    
    async def calculate_path_adjustment(self, player_scores: List[float]) -> Dict[str, Any]:
        """Calculate path adjustments based on player performance history"""
        try:
            if not player_scores:
                return {"adjustment": "normal_path", "reason": "no_scores"}
            
            # Calculate average score
            avg_score = sum(player_scores) / len(player_scores)
            recent_scores = player_scores[-3:] if len(player_scores) >= 3 else player_scores
            recent_avg = sum(recent_scores) / len(recent_scores)
            
            # Determine adjustment based on recent performance
            if recent_avg >= 75:
                adjustment = "skip_door"  # Skip next door
                reason = "excellent_performance"
            elif recent_avg >= 60:
                adjustment = "shorter_path"
                reason = "good_performance"
            elif recent_avg <= 25:
                adjustment = "add_door"  # Add extra door
                reason = "poor_performance"
            elif recent_avg <= 40:
                adjustment = "longer_path"
                reason = "below_average_performance"
            else:
                adjustment = "normal_path"
                reason = "average_performance"
            
            return {
                "adjustment": adjustment,
                "reason": reason,
                "average_score": avg_score,
                "recent_average": recent_avg,
                "total_responses": len(player_scores)
            }
            
        except Exception as e:
            logger.error(f"Path calculation failed: {e}")
            return {"adjustment": "normal_path", "reason": "calculation_error"}
    
    async def get_next_door_for_player(self, player_id: str, current_door_id: str, latest_score: float) -> Optional[Dict[str, Any]]:
        """Get the next door for a player based on their latest score and Neo4j path logic"""
        try:
            # Update player's current position in Neo4j
            await self.neo4j_service.create_player_path(player_id, "current_session", current_door_id)
            
            # Get next door based on score using Neo4j path logic
            next_door = await self.neo4j_service.get_next_door_by_score(current_door_id, latest_score)
            
            if next_door:
                return {
                    "door_id": next_door["door_id"],
                    "content": next_door["content"],
                    "theme": next_door["theme"],
                    "difficulty": next_door["difficulty"],
                    "path_type": self._get_path_recommendation(latest_score),
                    "score_threshold": next_door.get("threshold", 50)
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get next door for player: {e}")
            return None
    
    async def calculate_player_progress(self, player_id: str) -> Dict[str, Any]:
        """Calculate comprehensive player progress including remaining doors"""
        try:
            # Get current progress from Neo4j
            progress = await self.neo4j_service.get_player_progress(player_id)
            
            if not progress:
                return {"error": "Player progress not found"}
            
            # Calculate remaining doors to completion
            remaining_doors = await self.neo4j_service.calculate_remaining_doors(player_id, "final")
            
            return {
                "current_door": progress.get("current_door_id"),
                "current_content": progress.get("current_content"),
                "current_theme": progress.get("current_theme"),
                "remaining_doors": remaining_doors,
                "next_door_options": progress.get("next_doors", []),
                "completion_percentage": self._calculate_completion_percentage(remaining_doors)
            }
            
        except Exception as e:
            logger.error(f"Failed to calculate player progress: {e}")
            return {"error": str(e)}
    
    async def initialize_player_journey(self, player_id: str, theme: str, difficulty: str) -> Dict[str, Any]:
        """Initialize a new player's journey in the game graph"""
        try:
            # Initialize the game graph for this theme/difficulty if not exists
            door_ids = await self.neo4j_service.initialize_game_graph(theme, difficulty)
            
            if not door_ids:
                return {"error": "Failed to initialize game graph"}
            
            # Set player's starting position
            start_door_id = door_ids[0]  # First door is the starting door
            success = await self.neo4j_service.create_player_path(player_id, "new_session", start_door_id)
            
            if success:
                return {
                    "success": True,
                    "starting_door_id": start_door_id,
                    "total_doors_created": len(door_ids),
                    "theme": theme,
                    "difficulty": difficulty
                }
            else:
                return {"error": "Failed to set player starting position"}
                
        except Exception as e:
            logger.error(f"Failed to initialize player journey: {e}")
            return {"error": str(e)}
    
    def _calculate_completion_percentage(self, remaining_doors: int) -> float:
        """Calculate completion percentage based on remaining doors"""
        if remaining_doors < 0:
            return 0.0
        
        # Assume average game has 5-7 doors, adjust based on actual game design
        estimated_total_doors = 6
        completed_doors = max(0, estimated_total_doors - remaining_doors)
        
        return (completed_doors / estimated_total_doors) * 100.0
    
    async def get_scoring_analytics(self, player_id: str) -> Dict[str, Any]:
        """Get detailed scoring analytics for a player"""
        try:
            # This would typically pull from a database of player responses
            # For now, return a structure that shows what analytics would look like
            return {
                "player_id": player_id,
                "total_responses": 0,  # Would be pulled from database
                "average_creativity": 0.0,
                "average_feasibility": 0.0,
                "average_humor": 0.0,
                "average_originality": 0.0,
                "overall_average": 0.0,
                "improvement_trend": "stable",  # "improving", "declining", "stable"
                "strongest_metric": "creativity",
                "weakest_metric": "feasibility",
                "path_efficiency": 85.0,  # Percentage of optimal path taken
                "doors_skipped": 0,
                "extra_doors_taken": 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get scoring analytics: {e}")
            return {"error": str(e)}