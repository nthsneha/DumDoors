#!/usr/bin/env python3

import os
from dotenv import load_dotenv

print("🔍 Fresh Environment Debug")
print("=" * 40)

# Check current working directory
print(f"Current directory: {os.getcwd()}")

# Check if .env file exists
env_file = ".env"
if os.path.exists(env_file):
    print(f"✅ .env file exists: {env_file}")
    
    # Read .env file directly
    print("\n📄 Raw .env file content:")
    with open(env_file, 'r') as f:
        content = f.read()
        print(content[:500])  # First 500 chars
else:
    print(f"❌ .env file not found: {env_file}")

# Load environment variables
print("\n🔄 Loading environment variables...")
result = load_dotenv(override=True)
print(f"load_dotenv result: {result}")

# Check specific variables
print("\n📋 Environment Variables After Loading:")
vars_to_check = ['AI_PROVIDER', 'VERTEX_AI_PROJECT_ID', 'VERTEX_AI_LOCATION', 'GEMINI_MODEL', 'GEMINI_API_KEY']
for var in vars_to_check:
    value = os.getenv(var)
    if var == 'GEMINI_API_KEY' and value:
        value = value[:20] + "..."
    print(f"{var}: {value}")