import asyncio
import logging
import time
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from models.door import ScoringResult, ScoringRequest, ScoringMetrics, EvaluationWithOutcomeResponse
from services.ai_client import AIClient
from services.answer_comparison_engine import AnswerComparisonEngine
from services.reasoning_analyzer import ReasoningAnalyzer
from services.scoring_calculator import ScoringCalculator
from services.outcome_generator import OutcomeGenerator
from services.path_recommendation_engine import PathRecommendationEngine
from services.scenario_repository import ScenarioRepository
from services.expected_answer_manager import ExpectedAnswerManager

logger = logging.getLogger(__name__)

class ScoringService:
    """Enhanced service for scoring player responses with comprehensive evaluation"""
    
    def __init__(self, ai_client: AIClient, scenario_repository: ScenarioRepository):
        self.ai_client = ai_client
        self.scenario_repository = scenario_repository
        
        # Initialize new evaluation components
        self.answer_comparison_engine = AnswerComparisonEngine(ai_client)
        self.reasoning_analyzer = ReasoningAnalyzer(ai_client)
        self.scoring_calculator = ScoringCalculator()
        self.outcome_generator = OutcomeGenerator(ai_client)
        self.path_recommendation_engine = PathRecommendationEngine()
        self.expected_answer_manager = ExpectedAnswerManager(scenario_repository)
        
        # Keep legacy neo4j service for backward compatibility
        try:
            from services.neo4j_service import Neo4jService
            self.neo4j_service = Neo4jService()
        except ImportError:
            logger.warning("Neo4j service not available, some legacy features may not work")
            self.neo4j_service = None
    
    async def evaluate_response_with_outcome(self, scenario_id: str, player_response: str, 
                                           session_id: Optional[str] = None, 
                                           context: Optional[Dict[str, Any]] = None) -> EvaluationWithOutcomeResponse:
        """Enhanced response evaluation with outcomes and path recommendations"""
        start_time = time.time()
        
        try:
            # Get the scenario and expected answer
            scenario = await self.scenario_repository.get_scenario_by_id(scenario_id)
            if not scenario:
                raise Exception(f"Scenario not found: {scenario_id}")
            
            expected_answer = await self.expected_answer_manager.get_expected_answer(scenario_id)
            if not expected_answer:
                raise Exception(f"Expected answer not found for scenario: {scenario_id}")
            
            # Perform answer comparison
            comparison_score = await self.answer_comparison_engine.compare_responses(
                player_response, expected_answer.answer_text
            )
            
            # Analyze reasoning quality
            reasoning_score = await self.reasoning_analyzer.evaluate_reasoning_quality(
                player_response, scenario.content
            )
            
            # Calculate total score
            total_score = await self.scoring_calculator.calculate_total_score(
                comparison_score, reasoning_score, expected_answer.scoring_weight
            )
            
            # Determine score category
            score_category = await self.scoring_calculator.determine_score_category(total_score)
            
            # Generate exaggerated outcome
            exaggerated_outcome = await self.outcome_generator.generate_outcome_by_score(
                scenario.content, player_response, total_score
            )
            
            # Get path recommendation
            path_recommendation_data = await self.path_recommendation_engine.get_path_recommendation(total_score)
            
            # Get reasoning patterns for feedback
            reasoning_patterns = await self.reasoning_analyzer.identify_reasoning_patterns(player_response)
            
            # Generate detailed feedback
            scores_dict = {
                "total_score": total_score,
                "comparison_score": comparison_score,
                "reasoning_score": reasoning_score
            }
            detailed_feedback = await self.scoring_calculator.generate_detailed_feedback(
                scores_dict, reasoning_patterns
            )
            
            processing_time = (time.time() - start_time) * 1000
            
            return EvaluationWithOutcomeResponse(
                response_id=str(uuid.uuid4()),
                scenario_id=scenario_id,
                total_score=total_score,
                comparison_score=comparison_score,
                reasoning_score=reasoning_score,
                score_category=score_category,
                exaggerated_outcome=exaggerated_outcome,
                path_recommendation=path_recommendation_data["path_difficulty"],
                recommended_node_count=path_recommendation_data["recommended_node_count"],
                detailed_feedback=detailed_feedback,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            logger.error(f"Enhanced response evaluation failed: {e}")
            # Return a default response on error
            processing_time = (time.time() - start_time) * 1000
            return EvaluationWithOutcomeResponse(
                response_id=str(uuid.uuid4()),
                scenario_id=scenario_id,
                total_score=50.0,
                comparison_score=50.0,
                reasoning_score=50.0,
                score_category="average",
                exaggerated_outcome="Unable to generate outcome due to evaluation error.",
                path_recommendation="medium",
                recommended_node_count=6,
                detailed_feedback="Evaluation encountered an error. Please try again.",
                processing_time_ms=processing_time
            )

    async def score_response(self, door_content: str, response: str, context: Optional[Dict[str, Any]] = None) -> ScoringResult:
        """Score a player response and generate exaggerated outcome"""
        start_time = time.time()
        
        try:
            # Get AI scoring with exaggerated outcome in one call
            result = await self.ai_client.score_response_with_outcome(door_content, response, context)
            
            # Create scoring metrics
            metrics = ScoringMetrics(
                creativity=result.get('creativity', 50.0),
                feasibility=result.get('feasibility', 50.0),
                originality=result.get('originality', 50.0)
            )
            
            # Always calculate total score from individual metrics (don't trust AI's total)
            total_score = (metrics.creativity + metrics.feasibility + metrics.originality) / 3
            
            # Get the exaggerated outcome
            exaggerated_outcome = result.get('exaggerated_outcome', "Your choice leads to unexpected adventures!")
            
            processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            return ScoringResult(
                response_id=str(uuid.uuid4()),
                total_score=total_score,
                metrics=metrics,
                exaggerated_outcome=exaggerated_outcome,
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
            originality=50.0
        )
        
        return ScoringResult(
            response_id=response_id,
            total_score=50.0,
            metrics=default_metrics,
            exaggerated_outcome="Your choice leads to unexpected adventures!",
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
    
    async def get_evaluation_statistics(self) -> Dict[str, Any]:
        """Get statistics about the evaluation system"""
        try:
            # Get statistics from all components
            scoring_stats = self.scoring_calculator.get_scoring_statistics()
            path_stats = await self.path_recommendation_engine.get_path_statistics()
            outcome_stats = await self.outcome_generator.get_outcome_statistics()
            
            # Validate configurations
            scoring_validation = await self.scoring_calculator.validate_scoring_configuration()
            
            return {
                "scoring_calculator": scoring_stats,
                "path_recommendation": path_stats,
                "outcome_generator": outcome_stats,
                "configuration_validation": scoring_validation,
                "evaluation_components": {
                    "answer_comparison_engine": "active",
                    "reasoning_analyzer": "active",
                    "scoring_calculator": "active",
                    "outcome_generator": "active",
                    "path_recommendation_engine": "active"
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get evaluation statistics: {e}")
            return {"error": str(e)}

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
                "average_originality": 0.0,
                "overall_average": 0.0,
                "improvement_trend": "stable",  # "improving", "declining", "stable"
                "strongest_metric": "creativity",
                "weakest_metric": "feasibility",
                "path_efficiency": 85.0,  # Percentage of optimal path taken
                "doors_skipped": 0,
                "extra_doors_taken": 0,
                # Enhanced analytics
                "average_comparison_score": 0.0,
                "average_reasoning_score": 0.0,
                "score_category_distribution": {
                    "poor": 0,
                    "average": 0,
                    "excellent": 0
                },
                "path_difficulty_distribution": {
                    "shorter": 0,
                    "medium": 0,
                    "longer": 0
                },
                "reasoning_patterns_used": []
            }
            
        except Exception as e:
            logger.error(f"Failed to get scoring analytics: {e}")
            return {"error": str(e)}