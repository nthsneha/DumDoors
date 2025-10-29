#!/usr/bin/env python3
"""
Test script for the DumDoors AI Service
Demonstrates scenario generation and response evaluation
"""

import asyncio
import json
from ai_service_implementation import AIService

async def test_scenario_generation():
    """Test the scenario generation functionality"""
    print("🎯 Testing Scenario Generation")
    print("=" * 50)
    
    ai_service = AIService()
    
    # Generate 5 different scenarios
    for i in range(5):
        print(f"\n📝 Scenario {i+1}:")
        door = await ai_service.generate_door(theme="general", difficulty=5)
        print(f"Content: {door.content}")
        print(f"ID: {door.id}")
        print(f"Expected Solutions: {', '.join(door.expected_solution_types)}")

async def test_response_evaluation():
    """Test the response evaluation functionality"""
    print("\n\n🎯 Testing Response Evaluation")
    print("=" * 50)
    
    ai_service = AIService()
    
    # Test scenario
    test_scenario = "You accidentally send a love letter meant for your crush to your boss."
    
    # Test different quality responses
    test_responses = [
        {
            "response": "I would immediately send a follow-up email explaining it was meant for someone else and apologize for the confusion.",
            "description": "Good, practical response"
        },
        {
            "response": "Quit my job and move to another country to avoid the embarrassment.",
            "description": "Extreme, unrealistic response"
        },
        {
            "response": "Pretend it was a creative writing exercise and ask my boss for feedback on my 'fictional' love letter.",
            "description": "Creative, humorous response"
        },
        {
            "response": "Help",
            "description": "Very short response"
        },
        {
            "response": "I would use my time machine to go back and prevent this from happening, then use my mind control powers to make everyone forget.",
            "description": "Completely unrealistic response"
        }
    ]
    
    for i, test_case in enumerate(test_responses):
        print(f"\n📊 Test Case {i+1}: {test_case['description']}")
        print(f"Response: \"{test_case['response']}\"")
        
        result = await ai_service.score_response(test_scenario, test_case['response'])
        
        print(f"Overall Score: {result.score}/100")
        print(f"Creativity: {result.creativity}/100")
        print(f"Feasibility: {result.feasibility}/100")
        print(f"Humor: {result.humor}/100")
        print(f"Originality: {result.originality}/100")
        print(f"Best Outcome: {result.best_outcome}")
        print(f"Worst Outcome: {result.worst_outcome}")
        print(f"Reasoning: {result.reasoning}")
        print("-" * 30)

async def test_uniqueness():
    """Test that scenarios are unique each time"""
    print("\n\n🎯 Testing Scenario Uniqueness")
    print("=" * 50)
    
    ai_service = AIService()
    
    scenarios = []
    for i in range(10):
        door = await ai_service.generate_door()
        scenarios.append(door.content)
    
    unique_scenarios = set(scenarios)
    print(f"Generated {len(scenarios)} scenarios")
    print(f"Unique scenarios: {len(unique_scenarios)}")
    print(f"Uniqueness rate: {len(unique_scenarios)/len(scenarios)*100:.1f}%")
    
    if len(unique_scenarios) == len(scenarios):
        print("✅ All scenarios are unique!")
    else:
        print("⚠️ Some scenarios were duplicated")
        duplicates = [s for s in scenarios if scenarios.count(s) > 1]
        print(f"Duplicates: {set(duplicates)}")

async def main():
    """Run all tests"""
    print("🚀 DumDoors AI Service Test Suite")
    print("=" * 60)
    
    await test_scenario_generation()
    await test_response_evaluation()
    await test_uniqueness()
    
    print("\n\n✅ All tests completed!")
    print("\n💡 To run the AI service:")
    print("   python ai_service_implementation.py")
    print("\n💡 API will be available at:")
    print("   http://localhost:8000")
    print("   http://localhost:8000/docs (Swagger UI)")

if __name__ == "__main__":
    asyncio.run(main())