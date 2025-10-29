#!/usr/bin/env python3

import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

async def test_api_key():
    """Test API key with standard Gemini model"""
    
    print("🔑 Testing API Key with Standard Gemini Model")
    print("=" * 50)
    
    # Clear any Google Cloud credentials
    if 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
        del os.environ['GOOGLE_APPLICATION_CREDENTIALS']
        print("✅ Cleared GOOGLE_APPLICATION_CREDENTIALS")
    
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        model_name = os.getenv("GEMINI_MODEL")
        
        print(f"API Key: {'***' + api_key[-4:] if api_key else 'Not set'}")
        print(f"Model: {model_name}")
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        print("\n🔄 Testing generation...")
        
        # Test simple generation
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=100,
            temperature=0.7,
            top_p=0.95,
            top_k=40,
        )
        
        response = await asyncio.to_thread(
            model.generate_content,
            "Score this response: I would talk to my manager. Rate creativity (0-100), feasibility (0-100), originality (0-100). Format: Creativity: X, Feasibility: Y, Originality: Z",
            generation_config=generation_config
        )
        
        print(f"✅ Response received: {response.text}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api_key())