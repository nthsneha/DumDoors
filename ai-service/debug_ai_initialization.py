#!/usr/bin/env python3

import os
import sys
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_ai_initialization():
    """Debug AI provider initialization"""
    
    print("🔍 AI Provider Initialization Debug")
    print("=" * 50)
    
    # Check environment variables
    print("\n📋 Environment Variables:")
    print(f"AI_PROVIDER: {os.getenv('AI_PROVIDER')}")
    print(f"VERTEX_AI_PROJECT_ID: {os.getenv('VERTEX_AI_PROJECT_ID')}")
    print(f"VERTEX_AI_LOCATION: {os.getenv('VERTEX_AI_LOCATION')}")
    print(f"GEMINI_MODEL: {os.getenv('GEMINI_MODEL')}")
    print(f"GEMINI_API_KEY: {'***' + os.getenv('GEMINI_API_KEY', '')[-4:] if os.getenv('GEMINI_API_KEY') else 'Not set'}")
    
    # Check imports
    print("\n📦 Import Availability:")
    try:
        import google.generativeai as genai
        print("✅ google.generativeai: Available")
    except ImportError as e:
        print(f"❌ google.generativeai: {e}")
    
    try:
        from google.cloud import aiplatform
        from vertexai.preview.generative_models import GenerativeModel
        import vertexai
        print("✅ Vertex AI imports: Available")
    except ImportError as e:
        print(f"❌ Vertex AI imports: {e}")
    
    # Test AI client initialization
    print("\n🤖 AI Client Initialization:")
    try:
        from services.ai_client import AIClient
        client = AIClient()
        print(f"✅ AI Client initialized successfully")
        print(f"Provider type: {type(client.provider).__name__}")
        
        # Test health check
        import asyncio
        health = asyncio.run(client.health_check())
        print(f"Health check: {health}")
        
    except Exception as e:
        print(f"❌ AI Client initialization failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_ai_initialization()