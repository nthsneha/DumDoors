import logging
import os
from typing import Dict, Any, Optional

from models.door import PathDifficulty, ScoreCategory

logger = logging.getLogger(__name__)

class PathRecommendationEngine:
    """Engine for determining path difficulty and node count based on player performance"""
    
    def __init__(self):
        # Load path configuration from environment
        self.min_path_nodes = int(os.getenv("MIN_PATH_NODES", "3"))
        self.max_path_nodes = int(os.getenv("MAX_PATH_NODES", "10"))
        self.default_path_nodes = int(os.getenv("DEFAULT_PATH_NODES", "6"))
        
        # Load score thresholds
        self.poor_threshold = float(os.getenv("SCORE_THRESHOLD_POOR_MAX", "30"))
        self.excellent_threshold = float(os.getenv("SCORE_THRESHOLD_EXCELLENT_MIN", "70"))
        
        # Validate configuration
        self._validate_configuration()
        
        logger.info(f"PathRecommendationEngine initialized: min={self.min_path_nodes}, max={self.max_path_nodes}, default={self.default_path_nodes}")
        logger.info(f"Score thresholds: poor≤{self.poor_threshold}, excellent≥{self.excellent_threshold}")
    
    async def determine_path_difficulty(self, score: float) -> str:
        """Determine path difficulty based on score"""
        try:
            if score <= self.poor_threshold:
                return PathDifficulty.LONGER.value  # Poor performance = longer path (more practice)
            elif score >= self.excellent_threshold:
                return PathDifficulty.SHORTER.value  # Excellent performance = shorter path (fast track)
            else:
                return PathDifficulty.MEDIUM.value  # Average performance = medium path
                
        except Exception as e:
            logger.error(f"Error determining path difficulty: {e}")
            return PathDifficulty.MEDIUM.value  # Default to medium on error
    
    async def calculate_node_count(self, path_difficulty: str, base_nodes: Optional[int] = None) -> int:
        """Calculate number of nodes based on path difficulty"""
        try:
            if base_nodes is None:
                base_nodes = self.default_path_nodes
            
            if path_difficulty == PathDifficulty.SHORTER.value:
                # Shorter path: reduce nodes by 20-40%
                node_count = max(self.min_path_nodes, int(base_nodes * 0.6))
            elif path_difficulty == PathDifficulty.LONGER.value:
                # Longer path: increase nodes by 30-50%
                node_count = min(self.max_path_nodes, int(base_nodes * 1.4))
            else:  # Medium path
                node_count = base_nodes
            
            # Ensure within bounds
            node_count = max(self.min_path_nodes, min(self.max_path_nodes, node_count))
            
            logger.debug(f"Calculated node count: {node_count} for difficulty {path_difficulty} (base: {base_nodes})")
            
            return node_count
            
        except Exception as e:
            logger.error(f"Error calculating node count: {e}")
            return self.default_path_nodes
    
    async def get_path_recommendation(self, score: float, current_node_count: Optional[int] = None) -> Dict[str, Any]:
        """Get complete path recommendation based on score"""
        try:
            path_difficulty = await self.determine_path_difficulty(score)
            recommended_nodes = await self.calculate_node_count(path_difficulty, current_node_count)
            
            # Calculate adjustment from current path
            adjustment = "maintain"
            if current_node_count is not None:
                if recommended_nodes > current_node_count:
                    adjustment = "increase"
                elif recommended_nodes < current_node_count:
                    adjustment = "decrease"
            
            # Get explanation
            explanation = self._get_path_explanation(score, path_difficulty, recommended_nodes)
            
            return {
                "path_difficulty": path_difficulty,
                "recommended_node_count": recommended_nodes,
                "current_node_count": current_node_count,
                "adjustment": adjustment,
                "explanation": explanation,
                "score": score,
                "score_category": self._get_score_category(score)
            }
            
        except Exception as e:
            logger.error(f"Error getting path recommendation: {e}")
            return self._get_default_recommendation(score)
    
    async def get_path_configuration(self) -> Dict[str, int]:
        """Get current path configuration"""
        return {
            "min_path_nodes": self.min_path_nodes,
            "max_path_nodes": self.max_path_nodes,
            "default_path_nodes": self.default_path_nodes
        }
    
    async def calculate_path_efficiency(self, player_scores: list, actual_nodes: list) -> Dict[str, Any]:
        """Calculate how efficiently a player is progressing through paths"""
        try:
            if not player_scores or not actual_nodes or len(player_scores) != len(actual_nodes):
                return {"error": "Invalid input data for efficiency calculation"}
            
            total_efficiency = 0.0
            efficient_paths = 0
            
            for score, nodes in zip(player_scores, actual_nodes):
                # Calculate optimal nodes for this score
                optimal_difficulty = await self.determine_path_difficulty(score)
                optimal_nodes = await self.calculate_node_count(optimal_difficulty)
                
                # Calculate efficiency (lower actual nodes vs optimal = higher efficiency)
                if optimal_nodes > 0:
                    efficiency = min(100.0, (optimal_nodes / nodes) * 100.0)
                    total_efficiency += efficiency
                    
                    if efficiency >= 80:  # Consider 80%+ as efficient
                        efficient_paths += 1
            
            avg_efficiency = total_efficiency / len(player_scores) if player_scores else 0.0
            efficiency_rate = (efficient_paths / len(player_scores)) * 100.0 if player_scores else 0.0
            
            return {
                "average_efficiency": avg_efficiency,
                "efficient_paths_percentage": efficiency_rate,
                "total_paths": len(player_scores),
                "efficient_paths": efficient_paths,
                "efficiency_threshold": 80.0
            }
            
        except Exception as e:
            logger.error(f"Error calculating path efficiency: {e}")
            return {"error": str(e)}
    
    def _validate_configuration(self):
        """Validate path configuration"""
        try:
            if self.min_path_nodes <= 0:
                raise ValueError(f"MIN_PATH_NODES must be positive, got {self.min_path_nodes}")
            
            if self.max_path_nodes <= self.min_path_nodes:
                raise ValueError(f"MAX_PATH_NODES ({self.max_path_nodes}) must be greater than MIN_PATH_NODES ({self.min_path_nodes})")
            
            if not (self.min_path_nodes <= self.default_path_nodes <= self.max_path_nodes):
                raise ValueError(f"DEFAULT_PATH_NODES ({self.default_path_nodes}) must be between MIN ({self.min_path_nodes}) and MAX ({self.max_path_nodes})")
            
            if self.poor_threshold >= self.excellent_threshold:
                raise ValueError(f"Poor threshold ({self.poor_threshold}) must be less than excellent threshold ({self.excellent_threshold})")
            
            logger.info("Path configuration validation passed")
            
        except Exception as e:
            logger.error(f"Path configuration validation failed: {e}")
            # Set safe defaults
            self.min_path_nodes = 3
            self.max_path_nodes = 10
            self.default_path_nodes = 6
            self.poor_threshold = 30.0
            self.excellent_threshold = 70.0
            logger.warning("Using safe default configuration")
    
    def _get_score_category(self, score: float) -> str:
        """Get score category for the given score"""
        if score <= self.poor_threshold:
            return ScoreCategory.POOR.value
        elif score >= self.excellent_threshold:
            return ScoreCategory.EXCELLENT.value
        else:
            return ScoreCategory.AVERAGE.value
    
    def _get_path_explanation(self, score: float, path_difficulty: str, node_count: int) -> str:
        """Get explanation for path recommendation"""
        try:
            if path_difficulty == PathDifficulty.SHORTER.value:
                return f"Excellent performance (score: {score:.1f})! You've earned a shorter path with {node_count} scenarios to reach the finish faster."
            elif path_difficulty == PathDifficulty.LONGER.value:
                return f"Your performance (score: {score:.1f}) suggests more practice would be beneficial. Taking a longer path with {node_count} scenarios will help you improve."
            else:  # Medium
                return f"Good performance (score: {score:.1f})! You'll continue on the standard path with {node_count} scenarios."
                
        except Exception as e:
            logger.error(f"Error generating path explanation: {e}")
            return f"Continuing with {node_count} scenarios based on your performance."
    
    def _get_default_recommendation(self, score: float) -> Dict[str, Any]:
        """Get default recommendation when calculation fails"""
        return {
            "path_difficulty": PathDifficulty.MEDIUM.value,
            "recommended_node_count": self.default_path_nodes,
            "current_node_count": None,
            "adjustment": "maintain",
            "explanation": f"Using default path configuration due to calculation error (score: {score:.1f})",
            "score": score,
            "score_category": self._get_score_category(score),
            "error": "Calculation failed, using defaults"
        }
    
    async def get_path_statistics(self) -> Dict[str, Any]:
        """Get statistics about path recommendations"""
        return {
            "configuration": await self.get_path_configuration(),
            "thresholds": {
                "poor_threshold": self.poor_threshold,
                "excellent_threshold": self.excellent_threshold
            },
            "path_mappings": {
                "poor_performance": {
                    "score_range": f"0 - {self.poor_threshold}",
                    "path_difficulty": PathDifficulty.LONGER.value,
                    "typical_nodes": await self.calculate_node_count(PathDifficulty.LONGER.value),
                    "purpose": "More practice opportunities"
                },
                "average_performance": {
                    "score_range": f"{self.poor_threshold + 0.1:.1f} - {self.excellent_threshold - 0.1:.1f}",
                    "path_difficulty": PathDifficulty.MEDIUM.value,
                    "typical_nodes": await self.calculate_node_count(PathDifficulty.MEDIUM.value),
                    "purpose": "Standard progression"
                },
                "excellent_performance": {
                    "score_range": f"{self.excellent_threshold} - 100",
                    "path_difficulty": PathDifficulty.SHORTER.value,
                    "typical_nodes": await self.calculate_node_count(PathDifficulty.SHORTER.value),
                    "purpose": "Fast track for high performers"
                }
            }
        }
    
    def update_configuration(self, min_nodes: Optional[int] = None, 
                           max_nodes: Optional[int] = None,
                           default_nodes: Optional[int] = None) -> Dict[str, Any]:
        """Update path configuration"""
        try:
            old_config = {
                "min_path_nodes": self.min_path_nodes,
                "max_path_nodes": self.max_path_nodes,
                "default_path_nodes": self.default_path_nodes
            }
            
            # Temporarily store new values for validation
            new_min = min_nodes if min_nodes is not None else self.min_path_nodes
            new_max = max_nodes if max_nodes is not None else self.max_path_nodes
            new_default = default_nodes if default_nodes is not None else self.default_path_nodes
            
            # Validate new configuration
            if new_min <= 0:
                raise ValueError(f"min_nodes must be positive, got {new_min}")
            
            if new_max <= new_min:
                raise ValueError(f"max_nodes ({new_max}) must be greater than min_nodes ({new_min})")
            
            if not (new_min <= new_default <= new_max):
                raise ValueError(f"default_nodes ({new_default}) must be between min ({new_min}) and max ({new_max})")
            
            # Apply changes
            if min_nodes is not None:
                self.min_path_nodes = min_nodes
            if max_nodes is not None:
                self.max_path_nodes = max_nodes
            if default_nodes is not None:
                self.default_path_nodes = default_nodes
            
            new_config = {
                "min_path_nodes": self.min_path_nodes,
                "max_path_nodes": self.max_path_nodes,
                "default_path_nodes": self.default_path_nodes
            }
            
            logger.info(f"Updated path configuration: {old_config} -> {new_config}")
            
            return {
                "success": True,
                "old_configuration": old_config,
                "new_configuration": new_config
            }
            
        except Exception as e:
            logger.error(f"Error updating path configuration: {e}")
            return {
                "success": False,
                "error": str(e),
                "current_configuration": {
                    "min_path_nodes": self.min_path_nodes,
                    "max_path_nodes": self.max_path_nodes,
                    "default_path_nodes": self.default_path_nodes
                }
            }