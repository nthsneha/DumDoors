import asyncio
import logging
import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from models.door import Door, Theme, DifficultyLevel, CacheStats, CuratedScenario
from services.scenario_repository import ScenarioRepository

logger = logging.getLogger(__name__)

class DoorService:
    """Service for managing door retrieval from curated scenarios"""
    
    def __init__(self, scenario_repository: ScenarioRepository):
        self.scenario_repository = scenario_repository
        
        # Statistics for monitoring
        self.scenario_requests = 0
        self.successful_retrievals = 0
    
    async def get_curated_door(self, theme: Optional[Theme] = None, 
                              difficulty: Optional[DifficultyLevel] = None, 
                              context: Optional[Dict[str, Any]] = None) -> Optional[Door]:
        """Get a door from curated scenarios (difficulty ignored for now)"""
        try:
            self.scenario_requests += 1
            
            # Get a random scenario (theme filtering for future expansion)
            scenario = await self.scenario_repository.get_random_scenario(theme)
            
            if not scenario:
                logger.warning(f"No scenario found for theme={theme}")
                return None
            
            # Convert curated scenario to Door object
            door = self._convert_scenario_to_door(scenario, context)
            self.successful_retrievals += 1
            
            return door
            
        except Exception as e:
            logger.error(f"Failed to get curated door: {e}")
            return None
    
    async def generate_door(self, theme: Theme = Theme.GENERAL, difficulty: Optional[DifficultyLevel] = None, context: Optional[Dict[str, Any]] = None) -> Door:
        """Get a door from curated scenarios (replaces AI generation, difficulty ignored)"""
        try:
            # Try to get a door with the specified theme (or general)
            door = await self.get_curated_door(theme, None, context)
            
            if not door:
                # Fallback: get any scenario
                door = await self.get_curated_door(Theme.GENERAL, None, context)
            
            if not door:
                raise Exception("No curated scenarios available")
            
            return door
            
        except Exception as e:
            logger.error(f"Door retrieval failed: {e}")
            raise
    
    async def get_themed_doors(self, theme: str, count: int = 5) -> List[Door]:
        """Get multiple doors for a specific theme from curated scenarios"""
        try:
            theme_enum = Theme(theme.lower())
            doors = []
            
            # Get all scenarios for this theme
            scenarios = await self.scenario_repository.get_scenarios_by_theme(theme_enum)
            
            if not scenarios:
                logger.warning(f"No scenarios found for theme: {theme}")
                return []
            
            # Randomly select up to 'count' scenarios
            import random
            selected_scenarios = random.sample(scenarios, min(count, len(scenarios)))
            
            # Convert to Door objects
            for scenario in selected_scenarios:
                door = self._convert_scenario_to_door(scenario)
                doors.append(door)
            
            return doors
            
        except Exception as e:
            logger.error(f"Themed doors retrieval failed: {e}")
            raise
    
    async def get_scenario_stats(self) -> Dict[str, Any]:
        """Get scenario repository statistics"""
        try:
            success_rate = (self.successful_retrievals / self.scenario_requests * 100) if self.scenario_requests > 0 else 0
            
            return {
                "total_scenarios": await self.scenario_repository.get_scenario_count(),
                "scenario_requests": self.scenario_requests,
                "successful_retrievals": self.successful_retrievals,
                "success_rate": success_rate,
                "theme_distribution": await self.scenario_repository.get_theme_counts(),
                "difficulty_distribution": await self.scenario_repository.get_difficulty_counts(),
                "repository_loaded": self.scenario_repository.is_loaded()
            }
            
        except Exception as e:
            logger.error(f"Scenario stats retrieval failed: {e}")
            raise
    
    def _convert_scenario_to_door(self, scenario: CuratedScenario, context: Optional[Dict[str, Any]] = None) -> Door:
        """Convert a CuratedScenario to a Door object"""
        try:
            return Door(
                door_id=str(uuid.uuid4()),
                content=scenario.content,
                theme=scenario.theme,
                difficulty=scenario.difficulty,
                expected_solution_types=self._get_expected_solution_types(scenario.theme, scenario.difficulty),
                context=context,
                created_at=datetime.utcnow()
            )
        except Exception as e:
            logger.error(f"Error converting scenario to door: {e}")
            raise
    
    async def get_door_by_scenario_id(self, scenario_id: str, context: Optional[Dict[str, Any]] = None) -> Optional[Door]:
        """Get a specific door by scenario ID"""
        try:
            scenario = await self.scenario_repository.get_scenario_by_id(scenario_id)
            if not scenario:
                return None
            
            return self._convert_scenario_to_door(scenario, context)
            
        except Exception as e:
            logger.error(f"Error getting door by scenario ID {scenario_id}: {e}")
            return None
    
    def _get_expected_solution_types(self, theme: Theme, difficulty: Optional[DifficultyLevel] = None) -> List[str]:
        """Get expected solution types based on theme (difficulty not used currently)"""
        base_types = {
            Theme.GENERAL: ["problem-solving", "critical-thinking", "communication", "creativity"],
            Theme.WORKPLACE: ["negotiation", "delegation", "problem-solving", "communication"],
            Theme.SOCIAL: ["empathy", "communication", "conflict-resolution", "leadership"],
            Theme.ADVENTURE: ["resourcefulness", "courage", "planning", "adaptability"],
            Theme.MYSTERY: ["deduction", "investigation", "analysis", "intuition"],
            Theme.COMEDY: ["creativity", "timing", "wit", "originality"],
            Theme.SURVIVAL: ["resourcefulness", "prioritization", "risk-assessment", "adaptation"]
        }
        
        types = base_types.get(theme, ["problem-solving", "critical-thinking"])
        
        # Since all scenarios are same difficulty, we don't add complexity modifiers
        # This can be re-enabled when difficulty levels are introduced
        
        return types