import logging
import os
from typing import Dict, Any, Optional

from models.door import ScoreCategory

logger = logging.getLogger(__name__)

class ScoringCalculator:
    """Calculator for comprehensive response scoring"""
    
    def __init__(self):
        # Load scoring weights from environment
        self.comparison_weight = float(os.getenv("COMPARISON_WEIGHT", "0.6"))
        self.reasoning_weight = float(os.getenv("REASONING_WEIGHT", "0.4"))
        
        # Load score thresholds from environment
        self.poor_threshold = float(os.getenv("SCORE_THRESHOLD_POOR_MAX", "30"))
        self.excellent_threshold = float(os.getenv("SCORE_THRESHOLD_EXCELLENT_MIN", "70"))
        
        logger.info(f"ScoringCalculator initialized with weights: comparison={self.comparison_weight}, reasoning={self.reasoning_weight}")
        logger.info(f"Score thresholds: poor≤{self.poor_threshold}, excellent≥{self.excellent_threshold}")
    
    async def calculate_total_score(self, comparison_score: float, reasoning_score: float, 
                                  scenario_weight: float = 1.0) -> float:
        """Calculate total score from comparison and reasoning scores"""
        try:
            # Validate input scores
            comparison_score = max(0.0, min(100.0, comparison_score))
            reasoning_score = max(0.0, min(100.0, reasoning_score))
            scenario_weight = max(0.1, min(2.0, scenario_weight))
            
            # Calculate weighted average
            total_score = (
                (comparison_score * self.comparison_weight) +
                (reasoning_score * self.reasoning_weight)
            )
            
            # Apply scenario weight
            total_score *= scenario_weight
            
            # Ensure score stays within bounds
            total_score = max(0.0, min(100.0, total_score))
            
            logger.debug(f"Calculated total score: {total_score} (comparison: {comparison_score}, reasoning: {reasoning_score}, weight: {scenario_weight})")
            
            return total_score
            
        except Exception as e:
            logger.error(f"Error calculating total score: {e}")
            return 50.0  # Default score on error
    
    async def determine_score_category(self, total_score: float) -> str:
        """Determine score category based on total score"""
        try:
            if total_score <= self.poor_threshold:
                return ScoreCategory.POOR.value
            elif total_score >= self.excellent_threshold:
                return ScoreCategory.EXCELLENT.value
            else:
                return ScoreCategory.AVERAGE.value
                
        except Exception as e:
            logger.error(f"Error determining score category: {e}")
            return ScoreCategory.AVERAGE.value
    
    async def generate_detailed_feedback(self, scores: Dict[str, float], 
                                       reasoning_patterns: Optional[list] = None) -> str:
        """Generate detailed feedback based on scoring breakdown"""
        try:
            feedback_parts = []
            
            total_score = scores.get("total_score", 0.0)
            comparison_score = scores.get("comparison_score", 0.0)
            reasoning_score = scores.get("reasoning_score", 0.0)
            
            # Overall performance feedback
            if total_score >= self.excellent_threshold:
                feedback_parts.append("🌟 Excellent response! Your answer demonstrates strong understanding and reasoning.")
            elif total_score >= (self.poor_threshold + self.excellent_threshold) / 2:
                feedback_parts.append("👍 Good response with solid reasoning and understanding.")
            elif total_score > self.poor_threshold:
                feedback_parts.append("👌 Decent response, but there's room for improvement.")
            else:
                feedback_parts.append("💡 Your response shows some understanding, but needs significant improvement.")
            
            # Comparison score feedback
            if comparison_score >= 80:
                feedback_parts.append("Your solution closely matches the expected approach.")
            elif comparison_score >= 60:
                feedback_parts.append("Your solution has good elements but differs from the optimal approach.")
            elif comparison_score >= 40:
                feedback_parts.append("Your solution has some relevant points but misses key elements.")
            else:
                feedback_parts.append("Your solution needs to be more aligned with effective approaches.")
            
            # Reasoning score feedback
            if reasoning_score >= 80:
                feedback_parts.append("Your reasoning is clear, logical, and well-structured.")
            elif reasoning_score >= 60:
                feedback_parts.append("Your reasoning is generally sound with good logical flow.")
            elif reasoning_score >= 40:
                feedback_parts.append("Your reasoning shows some logic but could be more structured.")
            else:
                feedback_parts.append("Try to provide clearer reasoning and logical connections.")
            
            # Reasoning patterns feedback
            if reasoning_patterns:
                pattern_feedback = self._generate_pattern_feedback(reasoning_patterns)
                if pattern_feedback:
                    feedback_parts.append(pattern_feedback)
            
            # Improvement suggestions
            improvement_suggestions = self._generate_improvement_suggestions(scores, reasoning_patterns)
            if improvement_suggestions:
                feedback_parts.extend(improvement_suggestions)
            
            return " ".join(feedback_parts)
            
        except Exception as e:
            logger.error(f"Error generating detailed feedback: {e}")
            return "Unable to generate detailed feedback at this time."
    
    def _generate_pattern_feedback(self, patterns: list) -> str:
        """Generate feedback based on reasoning patterns"""
        try:
            if not patterns:
                return "Consider using more structured reasoning approaches."
            
            pattern_messages = {
                "causal_reasoning": "Good use of cause-and-effect thinking",
                "logical_structure": "Well-organized logical structure",
                "evidence_based": "Nice use of evidence-based reasoning",
                "step_by_step": "Excellent systematic approach",
                "alternative_consideration": "Great consideration of alternatives",
                "consequence_analysis": "Good analysis of potential outcomes"
            }
            
            found_patterns = [pattern_messages.get(pattern, pattern) for pattern in patterns if pattern in pattern_messages]
            
            if found_patterns:
                if len(found_patterns) == 1:
                    return f"Strength: {found_patterns[0]}."
                else:
                    return f"Strengths: {', '.join(found_patterns[:-1])}, and {found_patterns[-1]}."
            
            return ""
            
        except Exception as e:
            logger.error(f"Error generating pattern feedback: {e}")
            return ""
    
    def _generate_improvement_suggestions(self, scores: Dict[str, float], 
                                        reasoning_patterns: Optional[list] = None) -> list:
        """Generate specific improvement suggestions"""
        try:
            suggestions = []
            
            comparison_score = scores.get("comparison_score", 0.0)
            reasoning_score = scores.get("reasoning_score", 0.0)
            total_score = scores.get("total_score", 0.0)
            
            # Suggestions based on low scores
            if comparison_score < 50:
                suggestions.append("💡 Try to think about what the most effective solution would be.")
            
            if reasoning_score < 50:
                suggestions.append("🧠 Work on explaining your thought process more clearly.")
            
            # Suggestions based on missing reasoning patterns
            if reasoning_patterns is not None:
                if "causal_reasoning" not in reasoning_patterns and reasoning_score < 70:
                    suggestions.append("🔗 Try explaining why your solution would work.")
                
                if "step_by_step" not in reasoning_patterns and comparison_score < 70:
                    suggestions.append("📝 Consider breaking down your approach into clear steps.")
                
                if "consequence_analysis" not in reasoning_patterns and total_score < 60:
                    suggestions.append("🎯 Think about the potential outcomes of your solution.")
            
            # General suggestions for low overall scores
            if total_score < self.poor_threshold:
                suggestions.append("📚 Consider researching best practices for similar situations.")
                suggestions.append("🤔 Take time to think through the problem from different angles.")
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error generating improvement suggestions: {e}")
            return []
    
    async def calculate_score_breakdown(self, comparison_score: float, reasoning_score: float,
                                      scenario_weight: float = 1.0) -> Dict[str, Any]:
        """Calculate detailed score breakdown"""
        try:
            total_score = await self.calculate_total_score(comparison_score, reasoning_score, scenario_weight)
            category = await self.determine_score_category(total_score)
            
            # Calculate weighted contributions
            comparison_contribution = comparison_score * self.comparison_weight
            reasoning_contribution = reasoning_score * self.reasoning_weight
            
            breakdown = {
                "total_score": total_score,
                "comparison_score": comparison_score,
                "reasoning_score": reasoning_score,
                "score_category": category,
                "scenario_weight": scenario_weight,
                "weights": {
                    "comparison_weight": self.comparison_weight,
                    "reasoning_weight": self.reasoning_weight
                },
                "contributions": {
                    "comparison_contribution": comparison_contribution,
                    "reasoning_contribution": reasoning_contribution
                },
                "thresholds": {
                    "poor_threshold": self.poor_threshold,
                    "excellent_threshold": self.excellent_threshold
                }
            }
            
            return breakdown
            
        except Exception as e:
            logger.error(f"Error calculating score breakdown: {e}")
            return {
                "total_score": 50.0,
                "comparison_score": comparison_score,
                "reasoning_score": reasoning_score,
                "score_category": ScoreCategory.AVERAGE.value,
                "error": str(e)
            }
    
    async def validate_scoring_configuration(self) -> Dict[str, Any]:
        """Validate the scoring configuration"""
        try:
            validation_results = {
                "valid": True,
                "warnings": [],
                "errors": [],
                "configuration": {
                    "comparison_weight": self.comparison_weight,
                    "reasoning_weight": self.reasoning_weight,
                    "poor_threshold": self.poor_threshold,
                    "excellent_threshold": self.excellent_threshold
                }
            }
            
            # Check weight sum
            weight_sum = self.comparison_weight + self.reasoning_weight
            if abs(weight_sum - 1.0) > 0.01:
                validation_results["warnings"].append(f"Weights sum to {weight_sum}, not 1.0")
            
            # Check weight ranges
            if not (0.0 <= self.comparison_weight <= 1.0):
                validation_results["errors"].append(f"Comparison weight {self.comparison_weight} out of range [0,1]")
                validation_results["valid"] = False
            
            if not (0.0 <= self.reasoning_weight <= 1.0):
                validation_results["errors"].append(f"Reasoning weight {self.reasoning_weight} out of range [0,1]")
                validation_results["valid"] = False
            
            # Check threshold ranges
            if not (0.0 <= self.poor_threshold <= 100.0):
                validation_results["errors"].append(f"Poor threshold {self.poor_threshold} out of range [0,100]")
                validation_results["valid"] = False
            
            if not (0.0 <= self.excellent_threshold <= 100.0):
                validation_results["errors"].append(f"Excellent threshold {self.excellent_threshold} out of range [0,100]")
                validation_results["valid"] = False
            
            # Check threshold logic
            if self.poor_threshold >= self.excellent_threshold:
                validation_results["errors"].append(f"Poor threshold ({self.poor_threshold}) must be less than excellent threshold ({self.excellent_threshold})")
                validation_results["valid"] = False
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating scoring configuration: {e}")
            return {
                "valid": False,
                "errors": [str(e)],
                "warnings": [],
                "configuration": {}
            }
    
    def get_scoring_statistics(self) -> Dict[str, Any]:
        """Get scoring configuration statistics"""
        return {
            "weights": {
                "comparison_weight": self.comparison_weight,
                "reasoning_weight": self.reasoning_weight,
                "weight_sum": self.comparison_weight + self.reasoning_weight
            },
            "thresholds": {
                "poor_threshold": self.poor_threshold,
                "excellent_threshold": self.excellent_threshold,
                "average_range": f"{self.poor_threshold + 0.1:.1f} - {self.excellent_threshold - 0.1:.1f}"
            },
            "categories": {
                "poor": f"0 - {self.poor_threshold}",
                "average": f"{self.poor_threshold + 0.1:.1f} - {self.excellent_threshold - 0.1:.1f}",
                "excellent": f"{self.excellent_threshold} - 100"
            }
        }