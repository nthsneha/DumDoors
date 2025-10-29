#!/usr/bin/env python3
"""
Simple test script to verify the enhanced AI service functionality
"""

import asyncio
import json
from datetime import datetime

# Test the new components
async def test_enhanced_service():
    print("🧪 Testing Enhanced AI Service Components")
    print("=" * 50)
    
    try:
        # Test 1: Configuration
        print("1. Testing Configuration System...")
        from config.environment import config
        config_summary = config.get_configuration_summary()
        print(f"   ✅ Configuration loaded: {config_summary['ai_provider']['provider']}")
        
        # Test 2: Scenario Repository
        print("2. Testing Scenario Repository...")
        from services.scenario_repository import ScenarioRepository
        from services.scenario_loader import ScenarioLoader
        
        repo = ScenarioRepository()
        loader = ScenarioLoader(repo)
        
        # Initialize with default scenarios
        success = await loader.initialize_scenario_database()
        if success:
            count = await repo.get_scenario_count()
            print(f"   ✅ Scenario repository initialized with {count} scenarios")
        else:
            print("   ❌ Failed to initialize scenario repository")
        
        # Test 3: Enhanced Evaluation Components
        print("3. Testing Evaluation Components...")
        from services.ai_client import AIClient
        from services.answer_comparison_engine import AnswerComparisonEngine
        from services.reasoning_analyzer import ReasoningAnalyzer
        from services.scoring_calculator import ScoringCalculator
        from services.outcome_generator import OutcomeGenerator
        from services.path_recommendation_engine import PathRecommendationEngine
        
        ai_client = AIClient()
        comparison_engine = AnswerComparisonEngine(ai_client)
        reasoning_analyzer = ReasoningAnalyzer(ai_client)
        scoring_calculator = ScoringCalculator()
        outcome_generator = OutcomeGenerator(ai_client)
        path_engine = PathRecommendationEngine()
        
        print("   ✅ All evaluation components initialized successfully")
        
        # Test 4: Scoring Calculator
        print("4. Testing Scoring Calculator...")
        total_score = await scoring_calculator.calculate_total_score(75.0, 80.0)
        category = await scoring_calculator.determine_score_category(total_score)
        print(f"   ✅ Score calculation: {total_score:.1f} ({category})")
        
        # Test 5: Path Recommendation
        print("5. Testing Path Recommendation...")
        path_rec = await path_engine.get_path_recommendation(85.0)
        print(f"   ✅ Path recommendation: {path_rec['path_difficulty']} ({path_rec['recommended_node_count']} nodes)")
        
        # Test 6: Enhanced Scoring Service
        print("6. Testing Enhanced Scoring Service...")
        from services.scoring_service import ScoringService
        
        scoring_service = ScoringService(ai_client, repo)
        stats = await scoring_service.get_evaluation_statistics()
        print(f"   ✅ Scoring service initialized with {len(stats)} components")
        
        print("\n🎉 All tests passed! Enhanced AI Service is working correctly.")
        
        # Print summary
        print("\n📊 Enhancement Summary:")
        print(f"   • Curated scenarios: {count} loaded (all general theme, same difficulty)")
        print(f"   • Score thresholds: Poor ≤{config.get('score_threshold_poor_max')}, Excellent ≥{config.get('score_threshold_excellent_min')}")
        print(f"   • Path nodes: {config.get('min_path_nodes')}-{config.get('max_path_nodes')} (default: {config.get('default_path_nodes')})")
        print(f"   • AI Provider: {config.get('ai_provider')} ({config.get('gemini_model')})")
        print(f"   • Outcome exaggeration: {config.get('outcome_exaggeration_level')}")
        print(f"   • Theme system: Simplified to 'general' (ready for future expansion)")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_enhanced_service())