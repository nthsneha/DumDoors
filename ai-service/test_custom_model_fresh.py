#!/usr/bin/env python3

import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

async def test_custom_model():
    """Test custom model directly"""
    
    print("🧪 Testing Custom Model Direct Access")
    print("=" * 50)
    
    try:
        import vertexai
        from vertexai.preview.generative_models import GenerativeModel
        
        project_id = os.getenv("VERTEX_AI_PROJECT_ID")
        location = os.getenv("VERTEX_AI_LOCATION") 
        model_id = os.getenv("GEMINI_MODEL")
        
        print(f"Project: {project_id}")
        print(f"Location: {location}")
        print(f"Model ID: {model_id}")
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        # Construct model path
        model_path = f"projects/{project_id}/locations/{location}/models/{model_id}"
        print(f"Full model path: {model_path}")
        
        # Initialize model
        model = GenerativeModel(model_name=model_path)
        print("✅ Model initialized successfully")
        
        # Test simple generation
        print("\n🔄 Testing generation...")
        response = await asyncio.to_thread(
            model.generate_content,
            "Score this response: I would talk to my manager about the situation. Rate creativity (0-100), feasibility (0-100), originality (0-100).",
            generation_config={"max_output_tokens": 200, "temperature": 0.7}
        )
        
        print(f"✅ Response received: {response.text[:200]}...")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_custom_model())