#!/usr/bin/env python3

import os
from dotenv import load_dotenv

# Force reload the .env file
load_dotenv(override=True)

print("Environment Variables after fresh load:")
print(f"AI_PROVIDER: {os.getenv('AI_PROVIDER')}")
print(f"VERTEX_AI_PROJECT_ID: {os.getenv('VERTEX_AI_PROJECT_ID')}")
print(f"VERTEX_AI_LOCATION: {os.getenv('VERTEX_AI_LOCATION')}")
print(f"GEMINI_MODEL: {os.getenv('GEMINI_MODEL')}")