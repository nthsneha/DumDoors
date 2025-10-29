#!/usr/bin/env python3
"""
Debug which scenarios trigger the fallback outcome
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

async def test_multiple_scenarios():
    """Test multiple scenarios to see which ones fail"""
    
    print("🔍 Testing Multiple Scenarios for Fallback Issues")
    print("=" * 60)
    
    ai_client = AIClient()
    
    test_cases = [
        {
            "scenario": "You accidentally sent a personal email to your entire company. How do you handle this?",
            "response": "I immediately send a follow-up email apologizing for the mistake."
        },
        {
            "scenario": "You're stuck in an elevator with your boss for 2 hours. How do you use this time?",
            "response": "I start teaching them magic tricks using items from my pockets."
        },
        {
            "scenario": "Your presentation file corrupted 5 minutes before the big meeting. What's your plan?",
            "response": "I perform an interpretive dance to convey my business proposal."
        },
        {
            "scenario": "You find a wallet on the street with $500 cash. What do you do?",
            "response": "I take it to the police station immediately."
        },
        {
            "scenario": "Your colleague takes credit for your idea in a meeting. How do you respond?",
            "response": "I calmly interrupt and say 'Actually, that was my idea from last week's email.'"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 TEST {i}: {test_case['scenario'][:50]}...")
        print(f"Response: {test_case['response'][:50]}...")
        print("-" * 60)
        
        try:
            # Get the raw response from AI
            prompt = ai_client._build_scoring_with_outcome_prompt(
                test_case['scenario'], 
                test_case['response'], 
                {"test": True}
            )
            
            # Get raw AI response
            raw_response = await ai_client.provider.generate_text(prompt, max_tokens=800, temperature=0.7)
            
            print("🤖 Raw AI Response:")
            print(raw_response)
            print()
            
            # Test parsing
            parsed_result = ai_client._parse_scoring_with_outcome_result(raw_response)
            
            print("📊 Parsed Result:")
            print(f"   Creativity: {parsed_result['creativity']}")
            print(f"   Feasibility: {parsed_result['feasibility']}")
            print(f"   Originality: {parsed_result['originality']}")
            print(f"   Total: {parsed_result['total']}")
            
            if parsed_result['exaggerated_outcome'] == "Your choice leads to unexpected adventures!":
                print("❌ FALLBACK DETECTED!")
            else:
                print("✅ Custom outcome generated!")
            
            print(f"   Outcome: {parsed_result['exaggerated_outcome']}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
        
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_multiple_scenarios())