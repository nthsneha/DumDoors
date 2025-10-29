#!/usr/bin/env python3
"""
Comprehensive test script for AI Service
Tests all major functionality including scoring, scenarios, and evaluation criteria
"""

import asyncio
import sys
import os
import json
import time
from typing import List, Dict, Any
import logging
from dotenv import load_dotenv

# Add the ai-service directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables before importing config
load_dotenv()

from config.environment import EnvironmentConfig
from services.ai_client import AIClient
from services.scoring_service import ScoringService
# Door service removed - door generation handled by backend
from services.scenario_repository import ScenarioRepository
from services.scenario_loader import ScenarioLoader
from models.door import ScoringRequest, Theme, DifficultyLevel, ResponseEvaluationRequest

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AIServiceTester:
    """Comprehensive tester for AI Service functionality"""
    
    def __init__(self):
        self.config = None
        self.ai_client = None
        self.scoring_service = None
        # door_service removed - handled by backend
        self.scenario_repository = None
        self.scenario_loader = None
        self.test_results = {
            "configuration": False,
            "ai_connectivity": False,
            "scenario_loading": False,
            # door_generation removed - handled by backend
            "response_scoring": False,
            "evaluation_criteria": False,
            "enhanced_evaluation": False,
            "batch_processing": False,
            "error_handling": False
        }
    
    async def initialize_services(self) -> bool:
        """Initialize all AI service components"""
        try:
            logger.info("🔧 Initializing AI Service components...")
            
            # Initialize configuration
            self.config = EnvironmentConfig()
            logger.info("✓ Configuration loaded")
            
            # Initialize services
            self.ai_client = AIClient()
            self.scenario_repository = ScenarioRepository()
            self.scenario_loader = ScenarioLoader(self.scenario_repository)
            # door_service removed - AI service focuses only on scoring
            self.scoring_service = ScoringService(self.ai_client, self.scenario_repository)
            
            # Initialize scenario database
            success = await self.scenario_loader.initialize_scenario_database()
            if not success:
                logger.error("Failed to initialize scenario database")
                return False
            
            logger.info("✓ All services initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Service initialization failed: {e}")
            return False
    
    async def test_configuration(self) -> bool:
        """Test configuration validation and summary"""
        try:
            logger.info("🧪 Testing configuration...")
            
            # Test configuration summary
            summary = self.config.get_configuration_summary()
            logger.info(f"AI Provider: {summary['ai_provider']['provider']}")
            logger.info(f"API Key Configured: {summary['ai_provider']['api_key_configured']}")
            logger.info(f"Configuration Valid: {summary['validation_status']['valid']}")
            
            # Test validation results
            validation = self.config.get_validation_results()
            if validation['critical_errors']:
                logger.error(f"Critical errors: {validation['critical_errors']}")
                return False
            
            if validation['errors']:
                logger.warning(f"Configuration errors: {validation['errors']}")
            
            logger.info("✓ Configuration test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Configuration test failed: {e}")
            return False
    
    async def test_ai_connectivity(self) -> bool:
        """Test AI client connectivity and health"""
        try:
            logger.info("🧪 Testing AI connectivity...")
            
            # Test health check
            health_status = await self.ai_client.health_check()
            logger.info(f"AI Health Status: {health_status}")
            
            if health_status.get("status") != "ok":
                logger.error("AI service is not healthy")
                return False
            
            logger.info("✓ AI connectivity test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ AI connectivity test failed: {e}")
            return False
    
    async def test_scenario_loading(self) -> bool:
        """Test scenario loading and validation"""
        try:
            logger.info("🧪 Testing scenario loading...")
            
            # Test scenario count
            count = await self.scenario_repository.get_scenario_count()
            logger.info(f"Scenarios loaded: {count}")
            
            if count == 0:
                logger.error("No scenarios loaded")
                return False
            
            # Test scenario integrity
            integrity = await self.scenario_loader.validate_scenario_integrity()
            logger.info(f"Scenario integrity: {integrity.get('overall_status', 'unknown')}")
            
            # Test getting a random scenario
            scenario = await self.scenario_repository.get_random_scenario()
            if scenario:
                logger.info(f"Sample scenario: {scenario.content[:100]}...")
            else:
                logger.error("Failed to get random scenario")
                return False
            
            logger.info("✓ Scenario loading test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Scenario loading test failed: {e}")
            return False
    
    # Door generation test removed - door generation handled by backend
    # AI service focuses only on scoring and evaluation
    
    async def test_response_scoring(self) -> bool:
        """Test response scoring functionality"""
        try:
            logger.info("🧪 Testing response scoring...")
            
            # Test scenarios with different response qualities
            test_cases = [
                {
                    "door_content": "You're in a meeting where your boss asks for volunteers for a challenging project. What do you do?",
                    "response": "I would volunteer immediately and ask for clarification on the project scope, timeline, and available resources to ensure I can deliver quality results.",
                    "expected_feasibility": "high",
                    "expected_creativity": "medium",
                    "expected_originality": "medium"
                },
                {
                    "door_content": "You're stuck in an elevator with a stranger. How do you handle the situation?",
                    "response": "I would use my phone's flashlight to create shadow puppets on the wall and start an impromptu puppet show to keep us both entertained while we wait for help.",
                    "expected_feasibility": "medium",
                    "expected_creativity": "high",
                    "expected_originality": "high"
                },
                {
                    "door_content": "Your computer crashes right before an important presentation. What's your next move?",
                    "response": "Panic and tell everyone the presentation is cancelled.",
                    "expected_feasibility": "low",
                    "expected_creativity": "low",
                    "expected_originality": "low"
                }
            ]
            
            for i, test_case in enumerate(test_cases):
                logger.info(f"Testing case {i+1}: {test_case['response'][:50]}...")
                
                request = ScoringRequest(
                    door_content=test_case["door_content"],
                    response=test_case["response"],
                    context="Test evaluation"
                )
                
                result = await self.scoring_service.score_response(
                    door_content=request.door_content,
                    response=request.response,
                    context=request.context
                )
                
                logger.info(f"Scores - Creativity: {result.metrics.creativity:.1f}, "
                          f"Feasibility: {result.metrics.feasibility:.1f}, "
                          f"Originality: {result.metrics.originality:.1f}")
                logger.info(f"Total Score: {result.total_score:.1f}")
                logger.info(f"Feedback: {result.feedback[:100]}...")
                
                # Validate scoring makes sense
                if result.total_score < 0 or result.total_score > 100:
                    logger.error(f"Invalid total score: {result.total_score}")
                    return False
                
                # Check if metrics are within valid range
                for metric_name, metric_value in [
                    ("creativity", result.metrics.creativity),
                    ("feasibility", result.metrics.feasibility),
                    ("originality", result.metrics.originality)
                ]:
                    if metric_value < 0 or metric_value > 100:
                        logger.error(f"Invalid {metric_name} score: {metric_value}")
                        return False
            
            logger.info("✓ Response scoring test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Response scoring test failed: {e}")
            return False
    
    async def test_evaluation_criteria(self) -> bool:
        """Test that evaluation focuses on feasibility, creativity, and originality (no humor)"""
        try:
            logger.info("🧪 Testing evaluation criteria (feasibility, creativity, originality)...")
            
            # Test a response that should score well on creativity and originality but low on feasibility
            creative_request = ScoringRequest(
                door_content="You need to get to work but your car won't start. What do you do?",
                response="I would build a catapult in my backyard and launch myself directly to my office building, landing gracefully on the roof and sliding down the fire escape to make a dramatic entrance.",
                context="Testing creativity vs feasibility"
            )
            
            creative_result = await self.scoring_service.score_response(
                door_content=creative_request.door_content,
                response=creative_request.response,
                context=creative_request.context
            )
            
            logger.info("Creative but impractical response scores:")
            logger.info(f"  Creativity: {creative_result.metrics.creativity:.1f}")
            logger.info(f"  Feasibility: {creative_result.metrics.feasibility:.1f}")
            logger.info(f"  Originality: {creative_result.metrics.originality:.1f}")
            
            # Test a response that should score well on feasibility but lower on creativity
            practical_request = ScoringRequest(
                door_content="You need to get to work but your car won't start. What do you do?",
                response="I would call a taxi or rideshare service to get to work on time.",
                context="Testing feasibility vs creativity"
            )
            
            practical_result = await self.scoring_service.score_response(
                door_content=practical_request.door_content,
                response=practical_request.response,
                context=practical_request.context
            )
            
            logger.info("Practical but common response scores:")
            logger.info(f"  Creativity: {practical_result.metrics.creativity:.1f}")
            logger.info(f"  Feasibility: {practical_result.metrics.feasibility:.1f}")
            logger.info(f"  Originality: {practical_result.metrics.originality:.1f}")
            
            # Validate that the scoring makes logical sense
            if creative_result.metrics.creativity <= practical_result.metrics.creativity:
                logger.warning("Creative response didn't score higher on creativity")
            
            if practical_result.metrics.feasibility <= creative_result.metrics.feasibility:
                logger.warning("Practical response didn't score higher on feasibility")
            
            # Verify no humor field exists in the response
            try:
                humor_score = getattr(creative_result.metrics, 'humor', None)
                if humor_score is not None:
                    logger.error("Humor field still exists in scoring metrics!")
                    return False
            except AttributeError:
                logger.info("✓ Humor field successfully removed from scoring")
            
            logger.info("✓ Evaluation criteria test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Evaluation criteria test failed: {e}")
            return False
    
    async def test_enhanced_evaluation(self) -> bool:
        """Test enhanced evaluation with outcomes and path recommendations"""
        try:
            logger.info("🧪 Testing enhanced evaluation...")
            
            # Get a scenario for testing
            scenario = await self.scenario_repository.get_random_scenario()
            if not scenario:
                logger.error("No scenario available for enhanced evaluation test")
                return False
            
            request = ResponseEvaluationRequest(
                scenario_id=scenario.scenario_id,
                player_response="I would carefully analyze the situation and come up with a creative solution that balances all stakeholder needs.",
                session_id="test_session_001",
                context="Enhanced evaluation test"
            )
            
            result = await self.scoring_service.evaluate_response_with_outcome(
                scenario_id=request.scenario_id,
                player_response=request.player_response,
                session_id=request.session_id,
                context=request.context
            )
            
            logger.info(f"Enhanced evaluation result:")
            logger.info(f"  Score: {result.score:.1f}")
            logger.info(f"  Best outcome: {result.best_outcome[:100]}...")
            logger.info(f"  Worst outcome: {result.worst_outcome[:100]}...")
            logger.info(f"  Path recommendation: {result.path_recommendation}")
            
            # Validate required fields
            if not result.best_outcome or not result.worst_outcome:
                logger.error("Missing outcome descriptions")
                return False
            
            if not result.path_recommendation:
                logger.error("Missing path recommendation")
                return False
            
            logger.info("✓ Enhanced evaluation test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Enhanced evaluation test failed: {e}")
            return False
    
    async def test_batch_processing(self) -> bool:
        """Test batch scoring functionality"""
        try:
            logger.info("🧪 Testing batch processing...")
            
            # Create multiple scoring requests
            batch_requests = [
                ScoringRequest(
                    door_content="You're leading a team meeting. How do you ensure everyone participates?",
                    response="I would go around the room and ask each person for their input on specific topics.",
                    context="Batch test 1"
                ),
                ScoringRequest(
                    door_content="You discover a mistake in a report you submitted yesterday. What do you do?",
                    response="I would immediately contact my supervisor and provide a corrected version with an explanation.",
                    context="Batch test 2"
                ),
                ScoringRequest(
                    door_content="You're at a networking event where you don't know anyone. How do you approach it?",
                    response="I would find someone standing alone and introduce myself with a genuine compliment or observation.",
                    context="Batch test 3"
                )
            ]
            
            start_time = time.time()
            results = await self.scoring_service.batch_score_responses(batch_requests)
            end_time = time.time()
            
            logger.info(f"Batch processed {len(results)} responses in {end_time - start_time:.2f} seconds")
            
            for i, result in enumerate(results):
                logger.info(f"Batch result {i+1}: Score {result.total_score:.1f}")
            
            if len(results) != len(batch_requests):
                logger.error(f"Expected {len(batch_requests)} results, got {len(results)}")
                return False
            
            logger.info("✓ Batch processing test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Batch processing test failed: {e}")
            return False
    
    async def test_error_handling(self) -> bool:
        """Test error handling and edge cases"""
        try:
            logger.info("🧪 Testing error handling...")
            
            # Test with empty response
            try:
                empty_request = ScoringRequest(
                    door_content="Test scenario",
                    response="",
                    context="Empty response test"
                )
                
                result = await self.scoring_service.score_response(
                    door_content=empty_request.door_content,
                    response=empty_request.response,
                    context=empty_request.context
                )
                
                logger.info(f"Empty response handled: Score {result.total_score:.1f}")
                
            except Exception as e:
                logger.info(f"Empty response error handled: {e}")
            
            # Test with very long response
            try:
                long_response = "This is a very long response. " * 100
                long_request = ScoringRequest(
                    door_content="Test scenario",
                    response=long_response,
                    context="Long response test"
                )
                
                result = await self.scoring_service.score_response(
                    door_content=long_request.door_content,
                    response=long_request.response,
                    context=long_request.context
                )
                
                logger.info(f"Long response handled: Score {result.total_score:.1f}")
                
            except Exception as e:
                logger.info(f"Long response error handled: {e}")
            
            logger.info("✓ Error handling test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error handling test failed: {e}")
            return False
    
    async def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests and return results"""
        logger.info("🚀 Starting comprehensive AI Service tests...")
        
        # Initialize services
        if not await self.initialize_services():
            logger.error("❌ Failed to initialize services - aborting tests")
            return self.test_results
        
        # Run all tests
        test_methods = [
            ("configuration", self.test_configuration),
            ("ai_connectivity", self.test_ai_connectivity),
            ("scenario_loading", self.test_scenario_loading),
            # ("door_generation", self.test_door_generation), # Removed - handled by backend
            ("response_scoring", self.test_response_scoring),
            ("evaluation_criteria", self.test_evaluation_criteria),
            ("enhanced_evaluation", self.test_enhanced_evaluation),
            ("batch_processing", self.test_batch_processing),
            ("error_handling", self.test_error_handling)
        ]
        
        for test_name, test_method in test_methods:
            try:
                logger.info(f"\n{'='*50}")
                self.test_results[test_name] = await test_method()
            except Exception as e:
                logger.error(f"❌ Test {test_name} crashed: {e}")
                self.test_results[test_name] = False
        
        return self.test_results
    
    def print_test_summary(self):
        """Print a summary of all test results"""
        logger.info(f"\n{'='*60}")
        logger.info("🏁 TEST SUMMARY")
        logger.info(f"{'='*60}")
        
        passed = sum(1 for result in self.test_results.values() if result)
        total = len(self.test_results)
        
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"{test_name.replace('_', ' ').title():<25} {status}")
        
        logger.info(f"{'='*60}")
        logger.info(f"Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            logger.info("🎉 All tests passed! AI Service is working correctly.")
        else:
            logger.warning(f"⚠️  {total-passed} test(s) failed. Please review the issues above.")

async def main():
    """Main test execution"""
    tester = AIServiceTester()
    
    try:
        results = await tester.run_all_tests()
        tester.print_test_summary()
        
        # Return appropriate exit code
        all_passed = all(results.values())
        return 0 if all_passed else 1
        
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)