#!/usr/bin/env python3
"""
Debug AI provider initialization
"""

import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("🔍 Debugging AI Provider Initialization")
print("=" * 50)

# Check environment variables
print(f"AI_PROVIDER: {os.getenv('AI_PROVIDER')}")
print(f"VERTEX_AI_PROJECT_ID: {os.getenv('VERTEX_AI_PROJECT_ID')}")
print(f"VERTEX_AI_LOCATION: {os.getenv('VERTEX_AI_LOCATION')}")
print(f"GEMINI_MODEL: {os.getenv('GEMINI_MODEL')}")

# Test AI client initialization
try:
    from services.ai_client import AIClient
    
    print("\n🧪 Testing AI Client Initialization...")
    ai_client = AIClient()
    
    print(f"✅ AI Client created")
    print(f"Provider type: {type(ai_client.provider).__name__}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

async def main():
    # Test AI client initialization
    try:
        from services.ai_client import AIClient
        
        print("\n🧪 Testing AI Client Initialization...")
        ai_client = AIClient()
        
        print(f"✅ AI Client created")
        print(f"Provider type: {type(ai_client.provider).__name__}")
        
        # Test health check
        print("\n🏥 Testing AI Health Check...")
        health = await ai_client.provider.health_check()
        print(f"Health check result: {health}")
        
        # Test a simple scoring
        print("\n🎯 Testing Simple Scoring...")
        result = await ai_client.score_response_with_outcome(
            door_content="You're late for work. What do you do?",
            response="I call my boss to let them know I'm running late and provide an ETA.",
            context={"test": True}
        )
        
        print(f"Scoring result: {result}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())