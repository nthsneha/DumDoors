#!/usr/bin/env python3
"""
Focused test script for evaluation criteria validation
Tests specifically that the AI model evaluates responses based on feasibility, creativity, and originality
"""

import asyncio
import sys
import os
import logging
from typing import List, Dict, Tuple
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
from models.door import ScoringRequest

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EvaluationCriteriaTester:
    """Test evaluation criteria specifically"""
    
    def __init__(self):
        self.ai_client = None
        self.scoring_service = None
        self.scenario_repository = None
        self.scenario_loader = None
    
    async def initialize(self):
        """Initialize services"""
        try:
            config = EnvironmentConfig()
            self.ai_client = AIClient()
            self.scenario_repository = ScenarioRepository()
            self.scenario_loader = ScenarioLoader(self.scenario_repository)
            self.scoring_service = ScoringService(self.ai_client, self.scenario_repository)
            
            # Initialize scenarios
            await self.scenario_loader.initialize_scenario_database()
            logger.info("✓ Services initialized")
            return True
        except Exception as e:
            logger.error(f"❌ Initialization failed: {e}")
            return False
    
    async def test_evaluation_criteria(self):
        """Test specific evaluation scenarios to validate criteria"""
        
        test_scenarios = [
            {
                "name": "High Feasibility, Low Creativity",
                "door": "You're running late for work and your car won't start. What do you do?",
                "response": "I call a taxi or use a rideshare app to get to work.",
                "expected": {
                    "feasibility": "high",  # Very practical solution
                    "creativity": "low",    # Common, obvious solution
                    "originality": "low"    # Everyone thinks of this
                }
            },
            {
                "name": "High Creativity, Medium Feasibility",
                "door": "You're stuck in an elevator with a stranger for 2 hours. How do you pass the time?",
                "response": "I suggest we create an impromptu business plan together, combining our skills to solve a problem we both care about, and exchange contacts to potentially collaborate later.",
                "expected": {
                    "feasibility": "medium", # Possible but requires cooperation
                    "creativity": "high",    # Creative use of time
                    "originality": "high"    # Unique approach
                }
            },
            {
                "name": "Low Feasibility, High Creativity",
                "door": "Your presentation file got corrupted 5 minutes before your big meeting. What's your plan?",
                "response": "I quickly grab some office supplies and create an interactive physical demonstration using staplers, coffee cups, and sticky notes to represent my data points, turning the presentation into a hands-on workshop.",
                "expected": {
                    "feasibility": "low",    # Hard to execute well in 5 minutes
                    "creativity": "high",    # Very creative solution
                    "originality": "high"    # Highly original approach
                }
            },
            {
                "name": "Balanced Response",
                "door": "You notice a colleague is struggling with their workload but hasn't asked for help. How do you approach this?",
                "response": "I would approach them privately and offer specific help with tasks I'm good at, while also suggesting we discuss workload distribution with our manager to find a sustainable solution.",
                "expected": {
                    "feasibility": "high",   # Very doable approach
                    "creativity": "medium",  # Thoughtful but not groundbreaking
                    "originality": "medium"  # Good approach, not super unique
                }
            },
            {
                "name": "Poor Response (Low All)",
                "door": "You accidentally sent a personal email to your entire company. How do you handle this?",
                "response": "I would panic and hope nobody notices, then maybe quit my job.",
                "expected": {
                    "feasibility": "low",    # Not a practical solution
                    "creativity": "low",     # No creative problem-solving
                    "originality": "low"     # Common panic response
                }
            }
        ]
        
        results = []
        
        for i, scenario in enumerate(test_scenarios):
            logger.info(f"\n🧪 Testing: {scenario['name']}")
            logger.info(f"Scenario: {scenario['door']}")
            logger.info(f"Response: {scenario['response']}")
            
            request = ScoringRequest(
                response_id=f"eval_test_{i+1}",
                door_content=scenario['door'],
                response=scenario['response'],
                context={"test_type": "evaluation_criteria", "scenario_name": scenario['name']}
            )
            
            try:
                result = await self.scoring_service.score_response(
                    door_content=request.door_content,
                    response=request.response,
                    context=request.context
                )
                
                # Log actual scores
                logger.info(f"📊 Actual Scores:")
                logger.info(f"   Feasibility: {result.metrics.feasibility:.1f}/100")
                logger.info(f"   Creativity:  {result.metrics.creativity:.1f}/100")
                logger.info(f"   Originality: {result.metrics.originality:.1f}/100")
                logger.info(f"   Total Score: {result.total_score:.1f}/100")
                
                # Analyze if scores match expectations
                analysis = self.analyze_scores(result.metrics, scenario['expected'])
                logger.info(f"📈 Analysis: {analysis['summary']}")
                
                if analysis['issues']:
                    logger.warning("⚠️  Issues found:")
                    for issue in analysis['issues']:
                        logger.warning(f"   - {issue}")
                
                results.append({
                    'scenario': scenario['name'],
                    'scores': {
                        'feasibility': result.metrics.feasibility,
                        'creativity': result.metrics.creativity,
                        'originality': result.metrics.originality,
                        'total': result.total_score
                    },
                    'expected': scenario['expected'],
                    'analysis': analysis,
                    'exaggerated_outcome': result.exaggerated_outcome
                })
                
            except Exception as e:
                logger.error(f"❌ Failed to score scenario '{scenario['name']}': {e}")
                results.append({
                    'scenario': scenario['name'],
                    'error': str(e)
                })
        
        return results
    
    def analyze_scores(self, metrics, expected) -> Dict:
        """Analyze if scores match expected patterns"""
        issues = []
        
        # Convert expected levels to score ranges
        level_ranges = {
            'low': (0, 40),
            'medium': (40, 70),
            'high': (70, 100)
        }
        
        # Check each metric
        for metric_name in ['feasibility', 'creativity', 'originality']:
            actual_score = getattr(metrics, metric_name)
            expected_level = expected[metric_name]
            expected_range = level_ranges[expected_level]
            
            if not (expected_range[0] <= actual_score <= expected_range[1]):
                issues.append(f"{metric_name.title()} score {actual_score:.1f} doesn't match expected '{expected_level}' range {expected_range}")
        
        # Overall assessment
        if not issues:
            summary = "✅ Scores match expectations well"
        elif len(issues) == 1:
            summary = "⚠️ One metric doesn't match expectations"
        else:
            summary = "❌ Multiple metrics don't match expectations"
        
        return {
            'summary': summary,
            'issues': issues,
            'matches_expectations': len(issues) == 0
        }
    
    def print_summary(self, results: List[Dict]):
        """Print comprehensive summary of evaluation tests"""
        logger.info(f"\n{'='*80}")
        logger.info("🏁 EVALUATION CRITERIA TEST SUMMARY")
        logger.info(f"{'='*80}")
        
        successful_tests = [r for r in results if 'error' not in r]
        failed_tests = [r for r in results if 'error' in r]
        matching_expectations = [r for r in successful_tests if r['analysis']['matches_expectations']]
        
        logger.info(f"Total scenarios tested: {len(results)}")
        logger.info(f"Successful evaluations: {len(successful_tests)}")
        logger.info(f"Failed evaluations: {len(failed_tests)}")
        logger.info(f"Matching expectations: {len(matching_expectations)}")
        
        if failed_tests:
            logger.error("\n❌ Failed Tests:")
            for test in failed_tests:
                logger.error(f"   - {test['scenario']}: {test['error']}")
        
        if successful_tests:
            logger.info(f"\n📊 Score Analysis:")
            
            # Calculate average scores by expected level
            score_by_level = {'low': [], 'medium': [], 'high': []}
            
            for result in successful_tests:
                for metric in ['feasibility', 'creativity', 'originality']:
                    expected_level = result['expected'][metric]
                    actual_score = result['scores'][metric]
                    score_by_level[expected_level].append(actual_score)
            
            for level, scores in score_by_level.items():
                if scores:
                    avg_score = sum(scores) / len(scores)
                    logger.info(f"   Expected '{level}' responses averaged: {avg_score:.1f}/100 ({len(scores)} samples)")
            
            # Show detailed results
            logger.info(f"\n📋 Detailed Results:")
            for result in successful_tests:
                status = "✅" if result['analysis']['matches_expectations'] else "⚠️"
                logger.info(f"   {status} {result['scenario']}")
                logger.info(f"      F:{result['scores']['feasibility']:.0f} C:{result['scores']['creativity']:.0f} O:{result['scores']['originality']:.0f} → {result['scores']['total']:.0f}")
        
        # Overall assessment
        success_rate = len(matching_expectations) / len(successful_tests) if successful_tests else 0
        logger.info(f"\n🎯 Evaluation Accuracy: {success_rate:.1%}")
        
        if success_rate >= 0.8:
            logger.info("🎉 Excellent! The AI model is evaluating responses according to expectations.")
        elif success_rate >= 0.6:
            logger.info("👍 Good! The AI model mostly evaluates responses correctly, with some minor issues.")
        else:
            logger.warning("⚠️ The AI model's evaluation doesn't consistently match expectations. Consider reviewing the prompts or model configuration.")

async def main():
    """Run evaluation criteria tests"""
    tester = EvaluationCriteriaTester()
    
    if not await tester.initialize():
        return 1
    
    try:
        logger.info("🚀 Starting evaluation criteria validation...")
        results = await tester.test_evaluation_criteria()
        tester.print_summary(results)
        
        # Determine success
        successful_results = [r for r in results if 'error' not in r]
        matching_results = [r for r in successful_results if r['analysis']['matches_expectations']]
        success_rate = len(matching_results) / len(successful_results) if successful_results else 0
        
        return 0 if success_rate >= 0.6 else 1
        
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)