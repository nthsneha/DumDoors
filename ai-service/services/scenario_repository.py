import json
import logging
import random
from typing import List, Optional, Dict, Any
from pathlib import Path

from models.door import CuratedScenario, Theme, DifficultyLevel

logger = logging.getLogger(__name__)

class ScenarioRepository:
    """Repository for managing curated scenarios"""
    
    def __init__(self):
        self.scenarios: Dict[str, CuratedScenario] = {}
        self.scenarios_by_theme: Dict[Theme, List[CuratedScenario]] = {}
        self.scenarios_by_difficulty: Dict[DifficultyLevel, List[CuratedScenario]] = {}
        self.loaded = False
    
    async def load_scenarios_from_file(self, file_path: str) -> List[CuratedScenario]:
        """Load scenarios from JSONL file"""
        try:
            scenarios = []
            file_path_obj = Path(file_path)
            
            if not file_path_obj.exists():
                logger.error(f"Scenario file not found: {file_path}")
                return []
            
            with open(file_path, 'r', encoding='utf-8') as file:
                for line_num, line in enumerate(file, 1):
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        scenario_data = json.loads(line)
                        scenario = CuratedScenario(**scenario_data)
                        scenarios.append(scenario)
                        
                        # Store in main dictionary
                        self.scenarios[scenario.scenario_id] = scenario
                        
                        # Index by theme
                        if scenario.theme not in self.scenarios_by_theme:
                            self.scenarios_by_theme[scenario.theme] = []
                        self.scenarios_by_theme[scenario.theme].append(scenario)
                        
                        # Index by difficulty
                        if scenario.difficulty not in self.scenarios_by_difficulty:
                            self.scenarios_by_difficulty[scenario.difficulty] = []
                        self.scenarios_by_difficulty[scenario.difficulty].append(scenario)
                        
                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON on line {line_num} in {file_path}: {e}")
                        continue
                    except Exception as e:
                        logger.warning(f"Error processing scenario on line {line_num}: {e}")
                        continue
            
            self.loaded = True
            logger.info(f"Loaded {len(scenarios)} scenarios from {file_path}")
            return scenarios
            
        except Exception as e:
            logger.error(f"Failed to load scenarios from {file_path}: {e}")
            return []
    
    async def get_scenario_by_id(self, scenario_id: str) -> Optional[CuratedScenario]:
        """Get a specific scenario by ID"""
        return self.scenarios.get(scenario_id)
    
    async def get_random_scenario(self, theme: Optional[Theme] = None, 
                                difficulty: Optional[DifficultyLevel] = None) -> Optional[CuratedScenario]:
        """Get a random scenario, optionally filtered by theme (difficulty ignored for now)"""
        try:
            candidates = []
            
            if theme and theme != Theme.GENERAL:
                # Filter by specific theme (for future expansion)
                candidates = self.scenarios_by_theme.get(theme, [])
            else:
                # Use all scenarios (current behavior since all are general theme)
                candidates = list(self.scenarios.values())
            
            if not candidates:
                logger.warning(f"No scenarios found for theme={theme}")
                # Fallback to all scenarios if specific theme not found
                candidates = list(self.scenarios.values())
            
            if not candidates:
                logger.error("No scenarios available at all")
                return None
            
            return random.choice(candidates)
            
        except Exception as e:
            logger.error(f"Error getting random scenario: {e}")
            return None
    
    async def get_scenarios_by_theme(self, theme: Theme) -> List[CuratedScenario]:
        """Get all scenarios for a specific theme"""
        return self.scenarios_by_theme.get(theme, [])
    
    async def get_scenarios_by_difficulty(self, difficulty: DifficultyLevel) -> List[CuratedScenario]:
        """Get all scenarios for a specific difficulty level"""
        return self.scenarios_by_difficulty.get(difficulty, [])
    
    async def get_scenario_count(self) -> int:
        """Get total number of loaded scenarios"""
        return len(self.scenarios)
    
    async def get_theme_counts(self) -> Dict[str, int]:
        """Get count of scenarios by theme"""
        return {theme.value if theme else "none": len(scenarios) for theme, scenarios in self.scenarios_by_theme.items()}
    
    async def get_difficulty_counts(self) -> Dict[str, int]:
        """Get count of scenarios by difficulty"""
        return {difficulty.value if difficulty else "none": len(scenarios) for difficulty, scenarios in self.scenarios_by_difficulty.items()}
    
    async def validate_scenarios(self) -> Dict[str, Any]:
        """Validate loaded scenarios and return statistics"""
        try:
            validation_results = {
                "total_scenarios": len(self.scenarios),
                "valid_scenarios": 0,
                "invalid_scenarios": 0,
                "missing_fields": [],
                "theme_distribution": {},
                "difficulty_distribution": {},
                "validation_errors": []
            }
            
            for scenario_id, scenario in self.scenarios.items():
                try:
                    # Basic validation
                    if not scenario.content or not scenario.expected_answer:
                        validation_results["invalid_scenarios"] += 1
                        validation_results["validation_errors"].append(
                            f"Scenario {scenario_id}: Missing content or expected_answer"
                        )
                        continue
                    
                    if not scenario.reasoning_criteria:
                        validation_results["missing_fields"].append(f"{scenario_id}: reasoning_criteria")
                    
                    validation_results["valid_scenarios"] += 1
                    
                    # Count distributions
                    theme_key = scenario.theme.value
                    difficulty_key = scenario.difficulty.value
                    
                    validation_results["theme_distribution"][theme_key] = \
                        validation_results["theme_distribution"].get(theme_key, 0) + 1
                    validation_results["difficulty_distribution"][difficulty_key] = \
                        validation_results["difficulty_distribution"].get(difficulty_key, 0) + 1
                    
                except Exception as e:
                    validation_results["invalid_scenarios"] += 1
                    validation_results["validation_errors"].append(f"Scenario {scenario_id}: {str(e)}")
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating scenarios: {e}")
            return {"error": str(e)}
    
    def is_loaded(self) -> bool:
        """Check if scenarios have been loaded"""
        return self.loaded
    
    async def clear_scenarios(self):
        """Clear all loaded scenarios"""
        self.scenarios.clear()
        self.scenarios_by_theme.clear()
        self.scenarios_by_difficulty.clear()
        self.loaded = False
        logger.info("Cleared all scenarios from repository")