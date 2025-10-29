#!/usr/bin/env python3
"""
Debug the outcome parsing to see what the AI is actually returning
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

async def debug_ai_response():
    """Debug what the AI is actually returning"""
    
    print("🔍 Debugging AI Response Format")
    print("=" * 50)
    
    ai_client = AIClient()
    
    # Test a simple scenario
    door_content = "You accidentally sent a personal email to your entire company. How do you handle this?"
    response = "I immediately send a follow-up email apologizing for the mistake."
    
    print(f"Scenario: {door_content}")
    print(f"Response: {response}")
    print("\n🤖 Raw AI Response:")
    print("-" * 50)
    
    try:
        # Get the raw response from AI
        prompt = ai_client._build_scoring_with_outcome_prompt(door_content, response, {"test": True})
        
        print("📝 Prompt being sent to AI:")
        print(prompt)
        print("\n" + "=" * 50)
        
        # Get raw AI response
        raw_response = await ai_client.provider.generate_text(prompt, max_tokens=500, temperature=0.7)
        
        print("🤖 Raw AI Response:")
        print(raw_response)
        print("\n" + "=" * 50)
        
        # Test parsing
        parsed_result = ai_client._parse_scoring_with_outcome_result(raw_response)
        
        print("📊 Parsed Result:")
        for key, value in parsed_result.items():
            print(f"   {key}: {value}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_ai_response())