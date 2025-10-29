#!/usr/bin/env python3
"""
Setup script for Vertex AI configuration
Helps configure the AI service to work with Google Vertex AI
"""

import os
import sys
import subprocess
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_vertex_ai_dependencies():
    """Check if Vertex AI dependencies are installed"""
    try:
        import vertexai
        from google.cloud import aiplatform
        logger.info("✅ Vertex AI dependencies are installed")
        return True
    except ImportError as e:
        logger.error(f"❌ Vertex AI dependencies missing: {e}")
        logger.info("Install with: pip install google-cloud-aiplatform")
        return False

def check_authentication():
    """Check if Google Cloud authentication is set up"""
    try:
        # Check for service account key file
        service_account_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if service_account_path and os.path.exists(service_account_path):
            logger.info(f"✅ Service account key found: {service_account_path}")
            return True
        
        # Check for gcloud CLI authentication
        result = subprocess.run(["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], 
                              capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            logger.info(f"✅ gcloud authentication active: {result.stdout.strip()}")
            return True
        
        logger.warning("⚠️ No authentication found")
        return False
        
    except FileNotFoundError:
        logger.warning("⚠️ gcloud CLI not found")
        return False
    except Exception as e:
        logger.error(f"❌ Authentication check failed: {e}")
        return False

def get_project_id():
    """Get the current Google Cloud project ID"""
    try:
        # Try from environment
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("VERTEX_AI_PROJECT_ID")
        if project_id:
            logger.info(f"✅ Project ID from environment: {project_id}")
            return project_id
        
        # Try from gcloud
        result = subprocess.run(["gcloud", "config", "get-value", "project"], 
                              capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            project_id = result.stdout.strip()
            logger.info(f"✅ Project ID from gcloud: {project_id}")
            return project_id
        
        logger.warning("⚠️ No project ID found")
        return None
        
    except Exception as e:
        logger.error(f"❌ Failed to get project ID: {e}")
        return None

def test_vertex_ai_connection(project_id: str, location: str = "us-central1"):
    """Test Vertex AI connection"""
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        # Try to create a model instance
        model = GenerativeModel("gemini-1.5-flash")
        logger.info("✅ Vertex AI connection successful")
        return True
        
    except Exception as e:
        logger.error(f"❌ Vertex AI connection failed: {e}")
        return False

def update_env_file(project_id: str):
    """Update .env file with Vertex AI configuration"""
    try:
        env_path = ".env"
        
        # Read current .env file
        with open(env_path, 'r') as f:
            lines = f.readlines()
        
        # Update relevant lines
        updated_lines = []
        project_updated = False
        
        for line in lines:
            if line.startswith("VERTEX_AI_PROJECT_ID="):
                updated_lines.append(f"VERTEX_AI_PROJECT_ID={project_id}\n")
                project_updated = True
            elif line.startswith("# GOOGLE_CLOUD_PROJECT="):
                updated_lines.append(f"GOOGLE_CLOUD_PROJECT={project_id}\n")
            else:
                updated_lines.append(line)
        
        # Add project ID if not found
        if not project_updated:
            updated_lines.append(f"VERTEX_AI_PROJECT_ID={project_id}\n")
        
        # Write updated .env file
        with open(env_path, 'w') as f:
            f.writelines(updated_lines)
        
        logger.info(f"✅ Updated .env file with project ID: {project_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to update .env file: {e}")
        return False

def main():
    """Main setup function"""
    logger.info("🚀 Vertex AI Setup for DumDoors AI Service")
    logger.info("=" * 50)
    
    # Check dependencies
    if not check_vertex_ai_dependencies():
        logger.error("Please install Vertex AI dependencies first:")
        logger.error("pip install google-cloud-aiplatform")
        return 1
    
    # Check authentication
    if not check_authentication():
        logger.error("Please set up Google Cloud authentication:")
        logger.error("1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install")
        logger.error("2. Run: gcloud auth login")
        logger.error("3. Or set GOOGLE_APPLICATION_CREDENTIALS to your service account key file")
        return 1
    
    # Get project ID
    project_id = get_project_id()
    if not project_id:
        logger.error("Please set your Google Cloud project:")
        logger.error("1. Run: gcloud config set project YOUR_PROJECT_ID")
        logger.error("2. Or set VERTEX_AI_PROJECT_ID in your .env file")
        return 1
    
    # Test connection
    if not test_vertex_ai_connection(project_id):
        logger.error("Vertex AI connection failed. Please check:")
        logger.error("1. Project ID is correct")
        logger.error("2. Vertex AI API is enabled in your project")
        logger.error("3. You have proper permissions")
        return 1
    
    # Update .env file
    if update_env_file(project_id):
        logger.info("🎉 Vertex AI setup completed successfully!")
        logger.info("You can now run the AI service tests:")
        logger.info("python3 test_scoring_service.py")
        return 0
    else:
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)