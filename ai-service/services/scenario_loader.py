import os
import logging
from typing import Dict, Any, List
from pathlib import Path

from services.scenario_repository import ScenarioRepository
from services.expected_answer_manager import ExpectedAnswerManager

logger = logging.getLogger(__name__)

class ScenarioLoader:
    """Service for loading and initializing curated scenarios"""
    
    def __init__(self, scenario_repository: ScenarioRepository):
        self.scenario_repository = scenario_repository
        self.expected_answer_manager = ExpectedAnswerManager(scenario_repository)
        self.primary_file_path = os.getenv("CURATED_SCENARIOS_FILE_PATH", "data/scenarios.jsonl")
        self.backup_file_path = os.getenv("SCENARIO_BACKUP_FILE_PATH", "data/scenarios_backup.jsonl")
    
    async def initialize_scenario_database(self) -> bool:
        """Initialize the scenario database from JSONL files"""
        try:
            logger.info("Initializing scenario database...")
            
            # Clear existing scenarios
            await self.scenario_repository.clear_scenarios()
            
            # Try to load from primary file first
            scenarios_loaded = await self._load_from_primary_file()
            
            if not scenarios_loaded:
                logger.warning("Primary file failed, trying backup file...")
                scenarios_loaded = await self._load_from_backup_file()
            
            if not scenarios_loaded:
                logger.warning("Both files failed, loading default scenarios...")
                scenarios_loaded = await self._load_default_scenarios()
            
            if scenarios_loaded:
                # Validate loaded scenarios
                validation_results = await self.validate_scenario_integrity()
                logger.info(f"Scenario database initialized successfully. "
                          f"Loaded: {validation_results.get('total_scenarios', 0)} scenarios")
                return True
            else:
                logger.error("Failed to initialize scenario database")
                return False
                
        except Exception as e:
            logger.error(f"Error initializing scenario database: {e}")
            return False
    
    async def reload_scenarios(self) -> int:
        """Reload scenarios from file and return count of loaded scenarios"""
        try:
            logger.info("Reloading scenarios...")
            
            # Store current count for comparison
            old_count = await self.scenario_repository.get_scenario_count()
            
            # Reinitialize
            success = await self.initialize_scenario_database()
            
            if success:
                new_count = await self.scenario_repository.get_scenario_count()
                logger.info(f"Scenarios reloaded: {old_count} -> {new_count}")
                return new_count
            else:
                logger.error("Failed to reload scenarios")
                return 0
                
        except Exception as e:
            logger.error(f"Error reloading scenarios: {e}")
            return 0
    
    async def validate_scenario_integrity(self) -> Dict[str, Any]:
        """Validate the integrity of loaded scenarios"""
        try:
            logger.info("Validating scenario integrity...")
            
            # Get basic scenario validation
            scenario_validation = await self.scenario_repository.validate_scenarios()
            
            # Get expected answer validation
            answer_validation = await self.expected_answer_manager.validate_scenario_answers()
            
            # Get statistics
            answer_stats = await self.expected_answer_manager.get_answer_statistics()
            
            # Combine results
            integrity_results = {
                "scenario_validation": scenario_validation,
                "answer_validation": answer_validation,
                "answer_statistics": answer_stats,
                "overall_status": "healthy" if (
                    scenario_validation.get("valid_scenarios", 0) > 0 and
                    answer_validation.get("valid_answers", 0) > 0
                ) else "unhealthy",
                "total_scenarios": scenario_validation.get("total_scenarios", 0),
                "usable_scenarios": min(
                    scenario_validation.get("valid_scenarios", 0),
                    answer_validation.get("valid_answers", 0)
                )
            }
            
            return integrity_results
            
        except Exception as e:
            logger.error(f"Error validating scenario integrity: {e}")
            return {"error": str(e), "overall_status": "error"}
    
    async def _load_from_primary_file(self) -> bool:
        """Load scenarios from the primary file"""
        try:
            if not Path(self.primary_file_path).exists():
                logger.warning(f"Primary scenario file not found: {self.primary_file_path}")
                return False
            
            scenarios = await self.scenario_repository.load_scenarios_from_file(self.primary_file_path)
            
            if scenarios:
                logger.info(f"Loaded {len(scenarios)} scenarios from primary file")
                return True
            else:
                logger.warning("No scenarios loaded from primary file")
                return False
                
        except Exception as e:
            logger.error(f"Error loading from primary file: {e}")
            return False
    
    async def _load_from_backup_file(self) -> bool:
        """Load scenarios from the backup file"""
        try:
            if not Path(self.backup_file_path).exists():
                logger.warning(f"Backup scenario file not found: {self.backup_file_path}")
                return False
            
            scenarios = await self.scenario_repository.load_scenarios_from_file(self.backup_file_path)
            
            if scenarios:
                logger.info(f"Loaded {len(scenarios)} scenarios from backup file")
                return True
            else:
                logger.warning("No scenarios loaded from backup file")
                return False
                
        except Exception as e:
            logger.error(f"Error loading from backup file: {e}")
            return False
    
    async def _load_default_scenarios(self) -> bool:
        """Load default scenarios as a fallback"""
        try:
            from datetime import datetime
            from models.door import CuratedScenario, Theme, DifficultyLevel
            
            logger.info("Loading default scenarios as fallback...")
            
            default_scenarios = [
                {
                    "scenario_id": "default_001",
                    "content": "You're in a meeting where your boss asks for volunteers for a challenging project with tight deadlines. Everyone else stays silent. What do you do?",
                    "theme": Theme.GENERAL,
                    "difficulty": None,
                    "expected_answer": "Volunteer strategically by asking clarifying questions about resources, timeline, and support available, then commit if feasible.",
                    "reasoning_criteria": [
                        "Shows initiative and leadership",
                        "Demonstrates strategic thinking",
                        "Considers practical constraints",
                        "Communicates professionally"
                    ],
                    "key_concepts": ["leadership", "strategic thinking", "communication"],
                    "scoring_weight": 1.0,
                    "created_at": datetime.utcnow()
                },
                {
                    "scenario_id": "default_002",
                    "content": "You're at a party where you don't know anyone except the host, who is busy with other guests. How do you make the most of the evening?",
                    "theme": Theme.GENERAL,
                    "difficulty": None,
                    "expected_answer": "Approach small groups with open body language, introduce yourself genuinely, ask open-ended questions about others, and find common interests.",
                    "reasoning_criteria": [
                        "Shows social confidence",
                        "Demonstrates genuine interest in others",
                        "Uses effective conversation starters",
                        "Builds connections naturally"
                    ],
                    "key_concepts": ["social skills", "networking", "conversation"],
                    "scoring_weight": 1.0,
                    "created_at": datetime.utcnow()
                },
                {
                    "scenario_id": "default_003",
                    "content": "You're hiking alone and realize you've lost the trail. Your phone has no signal, and it's getting dark. What's your plan?",
                    "theme": Theme.GENERAL,
                    "difficulty": None,
                    "expected_answer": "Stay calm, stop moving, use remaining daylight to find shelter and signal materials, conserve energy, and wait for rescue while staying warm and hydrated.",
                    "reasoning_criteria": [
                        "Prioritizes safety over speed",
                        "Conserves resources effectively",
                        "Uses logical problem-solving",
                        "Maintains calm under pressure"
                    ],
                    "key_concepts": ["survival skills", "risk management", "problem solving"],
                    "scoring_weight": 1.0,
                    "created_at": datetime.utcnow()
                }
            ]
            
            # Load default scenarios into repository
            for scenario_data in default_scenarios:
                scenario = CuratedScenario(**scenario_data)
                self.scenario_repository.scenarios[scenario.scenario_id] = scenario
                
                # Index by theme
                if scenario.theme not in self.scenario_repository.scenarios_by_theme:
                    self.scenario_repository.scenarios_by_theme[scenario.theme] = []
                self.scenario_repository.scenarios_by_theme[scenario.theme].append(scenario)
                
                # Index by difficulty
                if scenario.difficulty not in self.scenario_repository.scenarios_by_difficulty:
                    self.scenario_repository.scenarios_by_difficulty[scenario.difficulty] = []
                self.scenario_repository.scenarios_by_difficulty[scenario.difficulty].append(scenario)
            
            self.scenario_repository.loaded = True
            logger.info(f"Loaded {len(default_scenarios)} default scenarios")
            return True
            
        except Exception as e:
            logger.error(f"Error loading default scenarios: {e}")
            return False
    
    async def get_loader_status(self) -> Dict[str, Any]:
        """Get the current status of the scenario loader"""
        try:
            return {
                "primary_file_path": self.primary_file_path,
                "backup_file_path": self.backup_file_path,
                "primary_file_exists": Path(self.primary_file_path).exists(),
                "backup_file_exists": Path(self.backup_file_path).exists(),
                "scenarios_loaded": self.scenario_repository.is_loaded(),
                "scenario_count": await self.scenario_repository.get_scenario_count(),
                "theme_distribution": await self.scenario_repository.get_theme_counts(),
                "difficulty_distribution": await self.scenario_repository.get_difficulty_counts()
            }
            
        except Exception as e:
            logger.error(f"Error getting loader status: {e}")
            return {"error": str(e)}
    
    async def create_sample_scenario_file(self, file_path: str) -> bool:
        """Create a sample scenario file for testing"""
        try:
            from datetime import datetime
            import json
            
            sample_scenarios = [
                {
                    "scenario_id": "sample_001",
                    "content": "Your team is behind on a critical project deadline. A colleague suggests cutting corners on quality to meet the deadline. What do you do?",
                    "theme": "general",
                    "difficulty": None,
                    "expected_answer": "Propose alternative solutions like requesting deadline extension, reallocating resources, or identifying which features are truly critical while maintaining quality standards.",
                    "reasoning_criteria": [
                        "Maintains quality standards",
                        "Seeks creative solutions",
                        "Communicates with stakeholders",
                        "Considers long-term consequences"
                    ],
                    "key_concepts": ["quality management", "project management", "stakeholder communication"],
                    "scoring_weight": 1.0,
                    "created_at": datetime.utcnow().isoformat()
                },
                {
                    "scenario_id": "sample_002",
                    "content": "You witness a friend being excluded from a group conversation at a social gathering. How do you handle this situation?",
                    "theme": "general",
                    "difficulty": None,
                    "expected_answer": "Naturally include your friend by redirecting conversation to topics they can contribute to, or create a bridge by mentioning something interesting about them to the group.",
                    "reasoning_criteria": [
                        "Shows empathy and loyalty",
                        "Handles situation tactfully",
                        "Includes others naturally",
                        "Maintains group harmony"
                    ],
                    "key_concepts": ["empathy", "social inclusion", "friendship"],
                    "scoring_weight": 1.0,
                    "created_at": datetime.utcnow().isoformat()
                }
            ]
            
            # Create directory if it doesn't exist
            Path(file_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Write scenarios to JSONL file
            with open(file_path, 'w', encoding='utf-8') as file:
                for scenario in sample_scenarios:
                    file.write(json.dumps(scenario) + '\n')
            
            logger.info(f"Created sample scenario file: {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating sample scenario file: {e}")
            return False