#!/usr/bin/env python3
"""
Test runner for AI Service
Runs comprehensive tests and evaluation criteria validation
"""

import asyncio
import sys
import os
import subprocess
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_test_script(script_name: str) -> int:
    """Run a test script and return exit code"""
    try:
        logger.info(f"🚀 Running {script_name}...")
        
        # Get the directory of this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.join(script_dir, script_name)
        
        # Run the test script
        result = subprocess.run([sys.executable, script_path], 
                              capture_output=False, 
                              text=True)
        
        if result.returncode == 0:
            logger.info(f"✅ {script_name} completed successfully")
        else:
            logger.error(f"❌ {script_name} failed with exit code {result.returncode}")
        
        return result.returncode
        
    except Exception as e:
        logger.error(f"❌ Failed to run {script_name}: {e}")
        return 1

def main():
    """Run all tests"""
    logger.info("🧪 AI Service Test Suite")
    logger.info("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("config/environment.py"):
        logger.error("❌ Please run this script from the ai-service directory")
        return 1
    
    # Check if .env file exists
    if not os.path.exists(".env"):
        logger.warning("⚠️ No .env file found. Make sure GEMINI_API_KEY is set in environment variables.")
    
    test_results = {}
    
    # Run core scoring service test (main functionality)
    logger.info("\n" + "=" * 60)
    logger.info("🎯 CORE SCORING SERVICE TEST")
    logger.info("=" * 60)
    test_results['scoring_service'] = run_test_script('test_scoring_service.py')
    
    # Run evaluation criteria test (validation of scoring logic)
    logger.info("\n" + "=" * 60)
    logger.info("📊 EVALUATION CRITERIA TEST")
    logger.info("=" * 60)
    test_results['evaluation_criteria'] = run_test_script('test_evaluation_criteria.py')
    
    # Run comprehensive test suite (all features)
    logger.info("\n" + "=" * 60)
    logger.info("🔧 COMPREHENSIVE SERVICE TEST")
    logger.info("=" * 60)
    test_results['comprehensive'] = run_test_script('test_ai_service_comprehensive.py')
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 FINAL TEST SUMMARY")
    logger.info("=" * 60)
    
    passed_tests = sum(1 for result in test_results.values() if result == 0)
    total_tests = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result == 0 else "❌ FAIL"
        logger.info(f"{test_name.replace('_', ' ').title():<25} {status}")
    
    logger.info("=" * 60)
    logger.info(f"Overall Result: {passed_tests}/{total_tests} test suites passed")
    
    if passed_tests == total_tests:
        logger.info("🎉 All test suites passed! Your AI service is working correctly.")
        return 0
    else:
        logger.warning(f"⚠️ {total_tests - passed_tests} test suite(s) failed. Please review the output above.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)