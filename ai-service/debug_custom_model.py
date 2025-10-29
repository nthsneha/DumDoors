#!/usr/bin/env python3

import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

async def test_models():
    """Test different model configurations"""
    
    print("🧪 Testing Different Model Configurations")
    print("=" * 60)
    
    try:
        import vertexai
        from vertexai.preview.generative_models import GenerativeModel
        
        project_id = os.getenv("VERTEX_AI_PROJECT_ID")
        location = os.getenv("VERTEX_AI_LOCATION") 
        custom_model_id = os.getenv("GEMINI_MODEL")
        
        print(f"Project: {project_id}")
        print(f"Location: {location}")
        print(f"Custom Model ID: {custom_model_id}")
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        # Test 1: Standard Gemini model
        print("\n🔄 Test 1: Standard Gemini Model")
        try:
            model = GenerativeModel("gemini-1.5-flash")
            response = await asyncio.to_thread(
                model.generate_content,
                "Hello, respond with just 'OK'",
                generation_config={"max_output_tokens": 10, "temperature": 0.1}
            )
            print(f"✅ Standard model works: {response.text.strip()}")
        except Exception as e:
            print(f"❌ Standard model failed: {e}")
        
        # Test 2: Custom model with different path formats
        print(f"\n🔄 Test 2: Custom Model Variations")
        
        # Format 1: Just the model ID
        try:
            print(f"Trying format 1: {custom_model_id}")
            model = GenerativeModel(custom_model_id)
            response = await asyncio.to_thread(
                model.generate_content,
                "Test",
                generation_config={"max_output_tokens": 10, "temperature": 0.1}
            )
            print(f"✅ Format 1 works: {response.text.strip()}")
        except Exception as e:
            print(f"❌ Format 1 failed: {e}")
        
        # Format 2: Full path
        try:
            full_path = f"projects/{project_id}/locations/{location}/models/{custom_model_id}"
            print(f"Trying format 2: {full_path}")
            model = GenerativeModel(full_path)
            response = await asyncio.to_thread(
                model.generate_content,
                "Test",
                generation_config={"max_output_tokens": 10, "temperature": 0.1}
            )
            print(f"✅ Format 2 works: {response.text.strip()}")
        except Exception as e:
            print(f"❌ Format 2 failed: {e}")
        
        # Format 3: Publishers path (for tuned models)
        try:
            publishers_path = f"projects/{project_id}/locations/{location}/publishers/google/models/{custom_model_id}"
            print(f"Trying format 3: {publishers_path}")
            model = GenerativeModel(publishers_path)
            response = await asyncio.to_thread(
                model.generate_content,
                "Test",
                generation_config={"max_output_tokens": 10, "temperature": 0.1}
            )
            print(f"✅ Format 3 works: {response.text.strip()}")
        except Exception as e:
            print(f"❌ Format 3 failed: {e}")
            
        # Format 4: TunedModels path
        try:
            tuned_path = f"tunedModels/{custom_model_id}"
            print(f"Trying format 4: {tuned_path}")
            model = GenerativeModel(tuned_path)
            response = await asyncio.to_thread(
                model.generate_content,
                "Test",
                generation_config={"max_output_tokens": 10, "temperature": 0.1}
            )
            print(f"✅ Format 4 works: {response.text.strip()}")
        except Exception as e:
            print(f"❌ Format 4 failed: {e}")
        
    except Exception as e:
        print(f"❌ Setup Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Unset the problematic environment variable
    if 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
        del os.environ['GOOGLE_APPLICATION_CREDENTIALS']
    
    asyncio.run(test_models())