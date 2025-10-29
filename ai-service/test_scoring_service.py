#!/usr/bin/env python3
"""
Simple test script for AI Scoring Service
Tests the core functionality: receiving door + response, returning score + feedback
"""

import asyncio
import sys
import os
import logging
from typing import Dict, Any
from dotenv import load_dotenv

# Add the ai-service directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables before importing config
load_dotenv()

from config.environment import EnvironmentConfig
from services.ai_client import AIClient
from services.scoring_service import ScoringService
from services.scenario_repository import ScenarioRepository
from services.scenario_loader import ScenarioLoader
from models.door import ScoringRequest, ResponseEvaluationRequest

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ScoringServiceTester:
    """Test the core AI scoring functionality"""
    
    def __init__(self):
        self.ai_client = None
        self.scoring_service = None
        self.scenario_repository = None
        self.scenario_loader = None
    
    async def initialize(self):
        """Initialize services"""
        try:
            logger.info("🔧 Initializing AI Scoring Service...")
            
            config = EnvironmentConfig()
            self.ai_client = AIClient()
            self.scenario_repository = ScenarioRepository()
            self.scenario_loader = ScenarioLoader(self.scenario_repository)
            self.scoring_service = ScoringService(self.ai_client, self.scenario_repository)
            
            # Initialize scenarios (for enhanced evaluation)
            await self.scenario_loader.initialize_scenario_database()
            
            logger.info("✅ Services initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Initialization failed: {e}")
            return False
    
    async def test_basic_scoring(self):
        """Test basic door + response → score + feedback flow"""
        logger.info("\n🧪 Testing Basic Scoring Flow")
        logger.info("=" * 50)
        
        # Simulate backend sending door + response to AI service
        test_cases = [
            {
                "name": "Workplace Scenario",
                "door_content": "You're in a team meeting and your colleague takes credit for your idea. How do you handle this situation?",
                "response": "I would address this privately with my colleague first, explaining how I feel and giving them a chance to correct it. If that doesn't work, I'd speak with my manager and provide documentation of my original contribution.",
                "expected_score_range": (60, 90)  # Should be a good, practical response
            },
            {
                "name": "Creative Problem Solving",
                "door_content": "You're locked out of your house with no keys, no phone, and it's starting to rain. What's your plan?",
                "response": "I would check if any windows are unlocked, look for a spare key in common hiding spots, ask neighbors for help or to use their phone, or find a way to contact a locksmith or family member.",
                "expected_score_range": (50, 80)  # Practical but common approach
            },
            {
                "name": "Highly Creative Response",
                "door_content": "You're giving a presentation and the projector breaks. How do you continue?",
                "response": "I would turn it into an interactive workshop, using the whiteboard to draw key concepts while getting the audience to participate by sharing their own experiences related to each point, making it more engaging than a regular presentation.",
                "expected_score_range": (70, 95)  # Creative and feasible
            }
        ]
        
        results = []
        
        for test_case in test_cases:
            logger.info(f"\n📝 Testing: {test_case['name']}")
            logger.info(f"Door: {test_case['door_content']}")
            logger.info(f"Response: {test_case['response'][:100]}...")
            
            try:
                # This simulates what the backend would send to the AI service
                request = ScoringRequest(
                    response_id=f"test_{test_case['name'].lower().replace(' ', '_')}",
                    door_content=test_case['door_content'],
                    response=test_case['response'],
                    context={"test_case": test_case['name'], "test_type": "basic_scoring"}
                )
                
                # AI service processes and returns scoring
                result = await self.scoring_service.score_response(
                    door_content=request.door_content,
                    response=request.response,
                    context=request.context
                )
                
                # Log the AI service response (what backend would receive)
                logger.info(f"📊 AI Service Response:")
                logger.info(f"   Total Score: {result.total_score:.1f}/100")
                logger.info(f"   Feasibility: {result.metrics.feasibility:.1f}/100")
                logger.info(f"   Creativity: {result.metrics.creativity:.1f}/100")
                logger.info(f"   Originality: {result.metrics.originality:.1f}/100")
                logger.info(f"   Exaggerated Outcome: {result.exaggerated_outcome[:150]}...")
                
                # Validate score is in expected range
                min_score, max_score = test_case['expected_score_range']
                score_valid = min_score <= result.total_score <= max_score
                
                if score_valid:
                    logger.info(f"✅ Score {result.total_score:.1f} is within expected range {min_score}-{max_score}")
                else:
                    logger.warning(f"⚠️ Score {result.total_score:.1f} is outside expected range {min_score}-{max_score}")
                
                results.append({
                    'test_case': test_case['name'],
                    'score': result.total_score,
                    'metrics': {
                        'feasibility': result.metrics.feasibility,
                        'creativity': result.metrics.creativity,
                        'originality': result.metrics.originality
                    },
                    'exaggerated_outcome': result.exaggerated_outcome,
                    'score_valid': score_valid,
                    'processing_time': result.processing_time_ms
                })
                
            except Exception as e:
                logger.error(f"❌ Test case '{test_case['name']}' failed: {e}")
                results.append({
                    'test_case': test_case['name'],
                    'error': str(e),
                    'score_valid': False
                })
        
        return results
    
    async def test_enhanced_evaluation(self):
        """Test enhanced evaluation - SIMPLIFIED: Just test basic scoring works"""
        logger.info("\n🧪 Testing Enhanced Evaluation (Simplified)")
        logger.info("=" * 50)
        
        try:
            # Since we simplified the service, just test that basic scoring works
            # with a more complex scenario
            request = ScoringRequest(
                response_id="enhanced_test",
                door_content="You discover your company is about to lay off half the team, including your best friend. You're not supposed to know this information. What do you do?",
                response="I would find a way to discreetly warn my friend while being careful not to reveal my source, perhaps by suggesting they update their resume 'just in case' and mentioning general industry trends.",
                context={"test_type": "enhanced_evaluation", "complexity": "high"}
            )
            
            result = await self.scoring_service.score_response(
                door_content=request.door_content,
                response=request.response,
                context=request.context
            )
            
            logger.info(f"📊 Enhanced Evaluation Response:")
            logger.info(f"   Score: {result.total_score:.1f}/100")
            logger.info(f"   Feasibility: {result.metrics.feasibility:.1f}/100")
            logger.info(f"   Creativity: {result.metrics.creativity:.1f}/100")
            logger.info(f"   Originality: {result.metrics.originality:.1f}/100")
            logger.info(f"   Exaggerated Outcome: {result.exaggerated_outcome[:100]}...")
            
            # Validate required fields
            has_score = result.total_score >= 0
            has_outcome = bool(result.exaggerated_outcome)
            
            if has_score and has_outcome:
                logger.info("✅ Enhanced evaluation working correctly")
                return True
            else:
                logger.error("❌ Enhanced evaluation missing required fields")
                return False
                
        except Exception as e:
            logger.error(f"❌ Enhanced evaluation test failed: {e}")
            return False
    
    async def test_batch_scoring(self):
        """Test batch scoring functionality"""
        logger.info("\n🧪 Testing Batch Scoring")
        logger.info("=" * 50)
        
        try:
            # Create batch request (simulating backend sending multiple door+response pairs)
            batch_requests = [
                ScoringRequest(
                    response_id="batch_test_1",
                    door_content="You find a wallet on the street with cash and ID. What do you do?",
                    response="I would take it to the nearest police station or try to contact the owner directly using the ID information.",
                    context={"test_type": "batch", "scenario": "ethical"}
                ),
                ScoringRequest(
                    response_id="batch_test_2",
                    door_content="Your friend asks you to lie to their partner about where they were last night. How do you respond?",
                    response="I would tell my friend I'm not comfortable lying and suggest they have an honest conversation with their partner instead.",
                    context={"test_type": "batch", "scenario": "relationship"}
                ),
                ScoringRequest(
                    response_id="batch_test_3",
                    door_content="You're running late for an important meeting and stuck in traffic. What's your next move?",
                    response="I would call ahead to inform them I'm running late, provide an updated ETA, and use the time to review my notes or prepare mentally for the meeting.",
                    context={"test_type": "batch", "scenario": "time_management"}
                )
            ]
            
            logger.info(f"Sending batch of {len(batch_requests)} requests to AI service...")
            
            # AI service processes batch
            results = await self.scoring_service.batch_score_responses(batch_requests)
            
            logger.info(f"📊 Batch Processing Results:")
            for i, result in enumerate(results):
                logger.info(f"   Request {i+1}: Score {result.total_score:.1f}, Outcome: {result.exaggerated_outcome[:50]}...")
            
            if len(results) == len(batch_requests):
                logger.info("✅ Batch scoring working correctly")
                return True
            else:
                logger.error(f"❌ Expected {len(batch_requests)} results, got {len(results)}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Batch scoring test failed: {e}")
            return False
    
    def print_summary(self, basic_results: list, enhanced_success: bool, batch_success: bool):
        """Print test summary"""
        logger.info("\n" + "=" * 60)
        logger.info("🏁 AI SCORING SERVICE TEST SUMMARY")
        logger.info("=" * 60)
        
        # Basic scoring results
        successful_basic = [r for r in basic_results if 'error' not in r]
        valid_scores = [r for r in successful_basic if r['score_valid']]
        
        logger.info(f"Basic Scoring Tests:")
        logger.info(f"  ✅ Successful: {len(successful_basic)}/{len(basic_results)}")
        logger.info(f"  🎯 Valid Scores: {len(valid_scores)}/{len(successful_basic)}")
        
        if successful_basic:
            avg_score = sum(r['score'] for r in successful_basic) / len(successful_basic)
            avg_time = sum(r.get('processing_time', 0) for r in successful_basic) / len(successful_basic)
            logger.info(f"  📊 Average Score: {avg_score:.1f}/100")
            logger.info(f"  ⏱️ Average Processing Time: {avg_time:.1f}ms")
        
        # Other tests
        logger.info(f"Enhanced Evaluation: {'✅ PASS' if enhanced_success else '❌ FAIL'}")
        logger.info(f"Batch Processing: {'✅ PASS' if batch_success else '❌ FAIL'}")
        
        # Overall assessment
        basic_success_rate = len(valid_scores) / len(basic_results) if basic_results else 0
        overall_success = basic_success_rate >= 0.7 and enhanced_success and batch_success
        
        logger.info("=" * 60)
        if overall_success:
            logger.info("🎉 AI Scoring Service is working correctly!")
            logger.info("✅ Ready for backend integration")
        else:
            logger.warning("⚠️ Some issues detected. Please review the results above.")
        
        logger.info("\n💡 Integration Notes:")
        logger.info("   - Backend generates doors, sends door+response to AI service")
        logger.info("   - AI service returns score + exaggerated outcome")
        logger.info("   - Backend uses scoring to determine next door and progression")
        logger.info("   - Exaggerated outcome provides entertaining feedback to player")

async def main():
    """Run scoring service tests"""
    tester = ScoringServiceTester()
    
    if not await tester.initialize():
        return 1
    
    try:
        # Test core functionality
        basic_results = await tester.test_basic_scoring()
        enhanced_success = await tester.test_enhanced_evaluation()
        batch_success = await tester.test_batch_scoring()
        
        # Print summary
        tester.print_summary(basic_results, enhanced_success, batch_success)
        
        # Determine success
        successful_basic = [r for r in basic_results if 'error' not in r and r['score_valid']]
        success_rate = len(successful_basic) / len(basic_results) if basic_results else 0
        
        overall_success = success_rate >= 0.7 and enhanced_success and batch_success
        return 0 if overall_success else 1
        
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)