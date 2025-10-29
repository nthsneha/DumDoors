import logging
from typing import List, Optional, Dict, Any

from models.door import ExpectedAnswer, CuratedScenario
from services.scenario_repository import ScenarioRepository

logger = logging.getLogger(__name__)

class ExpectedAnswerManager:
    """Manager for handling expected answers and reasoning criteria"""
    
    def __init__(self, scenario_repository: ScenarioRepository):
        self.scenario_repository = scenario_repository
    
    async def get_expected_answer(self, scenario_id: str) -> Optional[ExpectedAnswer]:
        """Get the expected answer for a specific scenario"""
        try:
            scenario = await self.scenario_repository.get_scenario_by_id(scenario_id)
            if not scenario:
                logger.warning(f"Scenario not found: {scenario_id}")
                return None
            
            return ExpectedAnswer(
                answer_text=scenario.expected_answer,
                reasoning_points=scenario.reasoning_criteria,
                key_concepts=scenario.key_concepts,
                scoring_weight=scenario.scoring_weight
            )
            
        except Exception as e:
            logger.error(f"Error getting expected answer for scenario {scenario_id}: {e}")
            return None
    
    async def get_reasoning_criteria(self, scenario_id: str) -> List[str]:
        """Get the reasoning criteria for a specific scenario"""
        try:
            scenario = await self.scenario_repository.get_scenario_by_id(scenario_id)
            if not scenario:
                logger.warning(f"Scenario not found: {scenario_id}")
                return []
            
            return scenario.reasoning_criteria
            
        except Exception as e:
            logger.error(f"Error getting reasoning criteria for scenario {scenario_id}: {e}")
            return []
    
    async def get_key_concepts(self, scenario_id: str) -> List[str]:
        """Get the key concepts for a specific scenario"""
        try:
            scenario = await self.scenario_repository.get_scenario_by_id(scenario_id)
            if not scenario:
                logger.warning(f"Scenario not found: {scenario_id}")
                return []
            
            return scenario.key_concepts
            
        except Exception as e:
            logger.error(f"Error getting key concepts for scenario {scenario_id}: {e}")
            return []
    
    async def validate_answer_format(self, answer: ExpectedAnswer) -> bool:
        """Validate that an expected answer has the correct format"""
        try:
            # Check required fields
            if not answer.answer_text or not answer.answer_text.strip():
                logger.warning("Expected answer missing answer_text")
                return False
            
            if not answer.reasoning_points:
                logger.warning("Expected answer missing reasoning_points")
                return False
            
            # Check scoring weight is valid
            if answer.scoring_weight < 0 or answer.scoring_weight > 2:
                logger.warning(f"Invalid scoring weight: {answer.scoring_weight}")
                return False
            
            # Check reasoning points are not empty
            for i, point in enumerate(answer.reasoning_points):
                if not point or not point.strip():
                    logger.warning(f"Empty reasoning point at index {i}")
                    return False
            
            # Check key concepts if provided
            if answer.key_concepts:
                for i, concept in enumerate(answer.key_concepts):
                    if not concept or not concept.strip():
                        logger.warning(f"Empty key concept at index {i}")
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating answer format: {e}")
            return False
    
    async def get_scoring_weight(self, scenario_id: str) -> float:
        """Get the scoring weight for a specific scenario"""
        try:
            scenario = await self.scenario_repository.get_scenario_by_id(scenario_id)
            if not scenario:
                logger.warning(f"Scenario not found: {scenario_id}")
                return 1.0  # Default weight
            
            return scenario.scoring_weight
            
        except Exception as e:
            logger.error(f"Error getting scoring weight for scenario {scenario_id}: {e}")
            return 1.0  # Default weight
    
    async def create_expected_answer_from_scenario(self, scenario: CuratedScenario) -> ExpectedAnswer:
        """Create an ExpectedAnswer object from a CuratedScenario"""
        try:
            return ExpectedAnswer(
                answer_text=scenario.expected_answer,
                reasoning_points=scenario.reasoning_criteria,
                key_concepts=scenario.key_concepts,
                scoring_weight=scenario.scoring_weight
            )
            
        except Exception as e:
            logger.error(f"Error creating expected answer from scenario: {e}")
            # Return a default expected answer
            return ExpectedAnswer(
                answer_text="Default answer due to error",
                reasoning_points=["Default reasoning"],
                key_concepts=[],
                scoring_weight=1.0
            )
    
    async def validate_scenario_answers(self) -> Dict[str, Any]:
        """Validate all expected answers in the repository"""
        try:
            validation_results = {
                "total_scenarios": 0,
                "valid_answers": 0,
                "invalid_answers": 0,
                "validation_errors": [],
                "missing_reasoning": 0,
                "missing_concepts": 0
            }
            
            # Get all scenarios from repository
            scenario_count = await self.scenario_repository.get_scenario_count()
            validation_results["total_scenarios"] = scenario_count
            
            # Validate each scenario's expected answer
            for scenario_id, scenario in self.scenario_repository.scenarios.items():
                try:
                    expected_answer = await self.create_expected_answer_from_scenario(scenario)
                    
                    if await self.validate_answer_format(expected_answer):
                        validation_results["valid_answers"] += 1
                    else:
                        validation_results["invalid_answers"] += 1
                        validation_results["validation_errors"].append(
                            f"Scenario {scenario_id}: Invalid expected answer format"
                        )
                    
                    # Check for missing reasoning criteria
                    if not scenario.reasoning_criteria:
                        validation_results["missing_reasoning"] += 1
                    
                    # Check for missing key concepts
                    if not scenario.key_concepts:
                        validation_results["missing_concepts"] += 1
                        
                except Exception as e:
                    validation_results["invalid_answers"] += 1
                    validation_results["validation_errors"].append(
                        f"Scenario {scenario_id}: {str(e)}"
                    )
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating scenario answers: {e}")
            return {"error": str(e)}
    
    async def get_answer_statistics(self) -> Dict[str, Any]:
        """Get statistics about expected answers"""
        try:
            stats = {
                "total_answers": 0,
                "avg_reasoning_points": 0.0,
                "avg_key_concepts": 0.0,
                "avg_answer_length": 0.0,
                "weight_distribution": {}
            }
            
            total_reasoning = 0
            total_concepts = 0
            total_length = 0
            weight_counts = {}
            
            for scenario in self.scenario_repository.scenarios.values():
                stats["total_answers"] += 1
                
                # Count reasoning points
                total_reasoning += len(scenario.reasoning_criteria)
                
                # Count key concepts
                total_concepts += len(scenario.key_concepts)
                
                # Measure answer length
                total_length += len(scenario.expected_answer)
                
                # Count weight distribution
                weight = scenario.scoring_weight
                weight_counts[weight] = weight_counts.get(weight, 0) + 1
            
            if stats["total_answers"] > 0:
                stats["avg_reasoning_points"] = total_reasoning / stats["total_answers"]
                stats["avg_key_concepts"] = total_concepts / stats["total_answers"]
                stats["avg_answer_length"] = total_length / stats["total_answers"]
            
            stats["weight_distribution"] = weight_counts
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting answer statistics: {e}")
            return {"error": str(e)}