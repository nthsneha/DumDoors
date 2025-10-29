#!/usr/bin/env python3
"""
Test script specifically for exaggerated outcomes
"""

import asyncio
import sys
import os
from dotenv import load_dotenv

# Add the ai-service directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

from services.ai_client import AIClient
from services.scoring_service import ScoringService
from services.scenario_repository import ScenarioRepository
from services.scenario_loader import ScenarioLoader
from models.door import ScoringRequest

async def test_exaggerated_outcomes():
    """Test exaggerated outcomes for different scenarios and responses"""
    
    print("🎭 Testing Exaggerated Outcomes")
    print("=" * 60)
    
    # Initialize services
    ai_client = AIClient()
    scenario_repository = ScenarioRepository()
    scenario_loader = ScenarioLoader(scenario_repository)
    scoring_service = ScoringService(ai_client, scenario_repository)
    
    # Initialize scenarios
    await scenario_loader.initialize_scenario_database()
    
    # Test scenarios with different types of responses
    test_cases = [
        {
            "scenario": "You accidentally sent a personal email to your entire company. How do you handle this?",
            "responses": [
                "I immediately send a follow-up email apologizing for the mistake and clarifying it was sent in error.",
                "I pretend it never happened and hope nobody notices.",
                "I send another email claiming it was a 'team building exercise' to see how people react to unexpected situations.",
                "I quit my job immediately and move to another country."
            ]
        },
        {
            "scenario": "You're stuck in an elevator with your boss for 2 hours. How do you use this time?",
            "responses": [
                "I use this as an opportunity to discuss my career goals and get feedback on my performance.",
                "I stay silent and avoid eye contact the entire time.",
                "I start teaching them magic tricks using items from my pockets.",
                "I pretend to be asleep for the entire 2 hours."
            ]
        },
        {
            "scenario": "Your presentation file corrupted 5 minutes before the big meeting. What's your plan?",
            "responses": [
                "I quickly outline key points on a whiteboard and deliver an interactive discussion instead.",
                "I panic and tell everyone the meeting is cancelled.",
                "I perform an interpretive dance to convey my business proposal.",
                "I blame the IT department and storm out of the room."
            ]
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🎬 SCENARIO {i}: {test_case['scenario']}")
        print("-" * 80)
        
        for j, response in enumerate(test_case['responses'], 1):
            print(f"\n📝 Response {j}: {response}")
            
            try:
                request = ScoringRequest(
                    response_id=f"test_{i}_{j}",
                    door_content=test_case['scenario'],
                    response=response,
                    context={"test_type": "exaggerated_outcome", "scenario": i, "response": j}
                )
                
                result = await scoring_service.score_response(
                    door_content=request.door_content,
                    response=request.response,
                    context=request.context
                )
                
                print(f"📊 Scores: C:{result.metrics.creativity:.0f} F:{result.metrics.feasibility:.0f} O:{result.metrics.originality:.0f} → Total:{result.total_score:.0f}")
                print(f"🎭 EXAGGERATED OUTCOME:")
                print(f"   {result.exaggerated_outcome}")
                
            except Exception as e:
                print(f"❌ Error: {e}")
        
        print("\n" + "=" * 80)

async def interactive_test():
    """Interactive test where you can input your own scenarios and responses"""
    
    print("\n🎮 INTERACTIVE EXAGGERATED OUTCOME TESTER")
    print("=" * 60)
    print("Enter your own scenarios and responses to see the exaggerated outcomes!")
    print("(Press Ctrl+C to exit)")
    
    # Initialize services
    ai_client = AIClient()
    scenario_repository = ScenarioRepository()
    scenario_loader = ScenarioLoader(scenario_repository)
    scoring_service = ScoringService(ai_client, scenario_repository)
    
    # Initialize scenarios
    await scenario_loader.initialize_scenario_database()
    
    try:
        while True:
            print("\n" + "-" * 60)
            scenario = input("🎬 Enter a scenario: ").strip()
            if not scenario:
                break
                
            response = input("📝 Enter your response: ").strip()
            if not response:
                break
            
            print("\n🤖 AI is thinking...")
            
            try:
                request = ScoringRequest(
                    response_id="interactive_test",
                    door_content=scenario,
                    response=response,
                    context={"test_type": "interactive"}
                )
                
                result = await scoring_service.score_response(
                    door_content=request.door_content,
                    response=request.response,
                    context=request.context
                )
                
                print(f"\n📊 SCORES:")
                print(f"   Creativity: {result.metrics.creativity:.1f}/100")
                print(f"   Feasibility: {result.metrics.feasibility:.1f}/100")
                print(f"   Originality: {result.metrics.originality:.1f}/100")
                print(f"   Total Score: {result.total_score:.1f}/100")
                
                print(f"\n🎭 EXAGGERATED OUTCOME:")
                print(f"   {result.exaggerated_outcome}")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                
    except KeyboardInterrupt:
        print("\n\n👋 Thanks for testing!")

async def main():
    """Main function"""
    print("Choose test mode:")
    print("1. Pre-defined scenarios (automatic)")
    print("2. Interactive mode (enter your own)")
    
    try:
        choice = input("\nEnter choice (1 or 2): ").strip()
        
        if choice == "1":
            await test_exaggerated_outcomes()
        elif choice == "2":
            await interactive_test()
        else:
            print("Invalid choice. Running pre-defined scenarios...")
            await test_exaggerated_outcomes()
            
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")

if __name__ == "__main__":
    asyncio.run(main())