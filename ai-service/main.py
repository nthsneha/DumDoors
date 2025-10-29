from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import logging
from dotenv import load_dotenv

from services.ai_client import AIClient
# Door service removed - door generation handled by backend
from services.scoring_service import ScoringService
from services.scenario_repository import ScenarioRepository
from services.scenario_loader import ScenarioLoader
from models.door import ScoringResult, ScoringRequest, CuratedScenarioResponse, Theme, DifficultyLevel, ResponseEvaluationRequest, EvaluationWithOutcomeResponse
from config.environment import config

# Load environment variables
load_dotenv()

# Initialize configuration
from config.environment import get_config
config = get_config()

# Configure logging
log_level = getattr(logging, config.get("log_level", "INFO").upper())
logging.basicConfig(level=log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DumDoors AI Scoring Service",
    description="AI service for response evaluation and scoring - door generation handled by backend",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ai_client = AIClient()
scenario_repository = ScenarioRepository()
scenario_loader = ScenarioLoader(scenario_repository)
# Door service removed - AI service focuses only on scoring
scoring_service = ScoringService(ai_client, scenario_repository)

# Initialize scenario database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize the scenario database and configuration on service startup"""
    initialization_success = True
    
    try:
        logger.info("Starting AI Service initialization...")
        
        # Step 1: Validate and log configuration
        logger.info("Validating service configuration...")
        config_validation = await _validate_service_configuration()
        
        if not config_validation["valid"]:
            logger.error(f"Configuration validation failed: {config_validation['errors']}")
            if config_validation["critical_errors"]:
                logger.critical("Critical configuration errors detected - service cannot start")
                raise ValueError(f"Critical configuration errors: {config_validation['critical_errors']}")
            else:
                logger.warning("Non-critical configuration issues detected - continuing with fallbacks")
                initialization_success = False
        
        # Log configuration summary
        config_summary = config.get_configuration_summary()
        logger.info(f"Configuration loaded: AI Provider={config_summary['ai_provider']['provider']}, "
                   f"Model={config_summary['ai_provider']['model']}")
        
        # Step 2: Initialize curated scenario database
        logger.info("Initializing curated scenario database...")
        scenario_success = await _initialize_curated_scenarios()
        
        if not scenario_success:
            logger.error("Failed to initialize curated scenarios - using fallback")
            initialization_success = False
        
        # Step 3: Validate AI service connectivity
        logger.info("Validating AI service connectivity...")
        ai_validation = await _validate_ai_connectivity()
        
        if not ai_validation["connected"]:
            logger.error(f"AI service connectivity failed: {ai_validation['error']}")
            initialization_success = False
        
        # Step 4: Initialize service components with error handling
        logger.info("Initializing service components...")
        component_success = await _initialize_service_components()
        
        if not component_success:
            logger.error("Some service components failed to initialize")
            initialization_success = False
        
        # Step 5: Final validation and status reporting
        if initialization_success:
            logger.info("AI Service initialization completed successfully")
        else:
            logger.warning("AI Service initialization completed with warnings - some features may be limited")
        
        # Log final service status
        await _log_service_status()
        
    except Exception as e:
        logger.error(f"Critical error during startup: {e}")
        logger.error("Service initialization failed - attempting graceful fallback")
        
        # Attempt graceful fallback initialization
        try:
            await _initialize_fallback_mode()
            logger.warning("Service started in fallback mode with limited functionality")
        except Exception as fallback_error:
            logger.critical(f"Fallback initialization also failed: {fallback_error}")
            raise RuntimeError(f"Service startup failed completely: {e}")

async def _validate_service_configuration() -> dict:
    """Validate service configuration and return validation results"""
    try:
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "critical_errors": []
        }
        
        # Check AI provider configuration
        ai_config = config.get_ai_config()
        if not ai_config.get("gemini_api_key"):
            validation_result["critical_errors"].append("GEMINI_API_KEY not configured")
            validation_result["valid"] = False
        
        # Check scenario file paths
        scenario_config = config.get_scenario_config()
        primary_path = scenario_config["curated_scenarios_file_path"]
        backup_path = scenario_config["scenario_backup_file_path"]
        
        if not os.path.exists(primary_path) and not os.path.exists(backup_path):
            validation_result["warnings"].append(f"Neither primary ({primary_path}) nor backup ({backup_path}) scenario files exist")
        
        # Check scoring configuration
        scoring_config = config.get_scoring_config()
        if scoring_config["score_threshold_poor_max"] >= scoring_config["score_threshold_excellent_min"]:
            validation_result["errors"].append("Score thresholds are invalid - poor max must be less than excellent min")
            validation_result["valid"] = False
        
        # Check path configuration
        path_config = config.get_path_config()
        if path_config["min_path_nodes"] >= path_config["max_path_nodes"]:
            validation_result["errors"].append("Path configuration invalid - min nodes must be less than max nodes")
            validation_result["valid"] = False
        
        # Check performance configuration
        perf_config = config.get_performance_config()
        if perf_config["evaluation_timeout_seconds"] <= 0:
            validation_result["errors"].append("Evaluation timeout must be positive")
            validation_result["valid"] = False
        
        return validation_result
        
    except Exception as e:
        logger.error(f"Configuration validation error: {e}")
        return {
            "valid": False,
            "errors": [f"Configuration validation exception: {e}"],
            "warnings": [],
            "critical_errors": [f"Configuration validation failed: {e}"]
        }

async def _initialize_curated_scenarios() -> bool:
    """Initialize curated scenarios with error handling and fallbacks"""
    try:
        # Attempt to initialize scenario database
        success = await scenario_loader.initialize_scenario_database()
        
        if success:
            scenario_count = await scenario_repository.get_scenario_count()
            logger.info(f"Curated scenario database initialized successfully with {scenario_count} scenarios")
            
            # Validate scenario integrity
            integrity_results = await scenario_loader.validate_scenario_integrity()
            if integrity_results.get("overall_status") == "healthy":
                logger.info(f"Scenario integrity validation passed - {integrity_results.get('usable_scenarios', 0)} usable scenarios")
                return True
            else:
                logger.warning(f"Scenario integrity issues detected: {integrity_results}")
                return False
        else:
            logger.error("Failed to initialize curated scenario database")
            return False
            
    except Exception as e:
        logger.error(f"Error initializing curated scenarios: {e}")
        return False

async def _validate_ai_connectivity() -> dict:
    """Validate AI service connectivity"""
    try:
        # Test AI client health
        ai_status = await ai_client.health_check()
        
        if ai_status.get("status") == "ok":
            logger.info("AI service connectivity validated successfully")
            return {"connected": True, "status": ai_status}
        else:
            logger.error(f"AI service connectivity failed: {ai_status}")
            return {"connected": False, "error": "AI service health check failed", "status": ai_status}
            
    except Exception as e:
        logger.error(f"AI connectivity validation error: {e}")
        return {"connected": False, "error": str(e)}

async def _initialize_service_components() -> bool:
    """Initialize service components with error handling"""
    try:
        component_success = True
        
        # Test scoring service initialization
        try:
            evaluation_stats = await scoring_service.get_evaluation_statistics()
            if evaluation_stats.get("configuration_validation", {}).get("valid", False):
                logger.info("Scoring service initialized successfully")
            else:
                logger.warning("Scoring service configuration issues detected")
                component_success = False
        except Exception as e:
            logger.error(f"Scoring service initialization failed: {e}")
            component_success = False
        
        # Door service removed - AI service focuses only on scoring
        # Scenario validation is handled by scenario loader
        
        return component_success
        
    except Exception as e:
        logger.error(f"Service component initialization error: {e}")
        return False

async def _initialize_fallback_mode() -> None:
    """Initialize service in fallback mode with minimal functionality"""
    try:
        logger.info("Initializing service in fallback mode...")
        
        # Create minimal default scenarios if none exist
        scenario_count = await scenario_repository.get_scenario_count()
        if scenario_count == 0:
            logger.info("Creating minimal default scenarios for fallback mode")
            await scenario_loader._load_default_scenarios()
        
        # Validate minimal functionality
        fallback_count = await scenario_repository.get_scenario_count()
        if fallback_count > 0:
            logger.info(f"Fallback mode initialized with {fallback_count} scenarios")
        else:
            raise RuntimeError("Cannot initialize even fallback scenarios")
            
    except Exception as e:
        logger.error(f"Fallback mode initialization failed: {e}")
        raise

async def _log_service_status() -> None:
    """Log comprehensive service status"""
    try:
        # Get service statistics
        scenario_count = await scenario_repository.get_scenario_count()
        loader_status = await scenario_loader.get_loader_status()
        config_summary = config.get_configuration_summary()
        
        logger.info("=== AI Service Status ===")
        logger.info(f"Scenarios loaded: {scenario_count}")
        logger.info(f"Primary scenario file: {loader_status.get('primary_file_exists', False)}")
        logger.info(f"Backup scenario file: {loader_status.get('backup_file_exists', False)}")
        logger.info(f"AI Provider: {config_summary['ai_provider']['provider']}")
        logger.info(f"Configuration valid: {config_summary['ai_provider']['api_key_configured']}")
        logger.info("========================")
        
    except Exception as e:
        logger.error(f"Error logging service status: {e}")

@app.get("/")
async def root():
    return {
        "message": "DumDoors AI Scoring Service", 
        "status": "running", 
        "version": "2.0.0",
        "description": "AI service for response evaluation and scoring - door generation handled by backend"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for service monitoring"""
    try:
        # Test AI client connection
        ai_status = await ai_client.health_check()
        return {
            "status": "ok",
            "service": "dumdoors-ai-scoring-service",
            "version": "2.0.0",
            "description": "AI scoring and evaluation service",
            "ai_client": ai_status
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

# Door generation is handled by the backend - AI service only handles scoring

@app.post("/scoring/score-response", response_model=ScoringResult)
async def score_response(request: ScoringRequest):
    """Score a player's response and generate exaggerated outcome"""
    try:
        result = await scoring_service.score_response(
            door_content=request.door_content,
            response=request.response,
            context=request.context
        )
        return result
    except Exception as e:
        logger.error(f"Response scoring failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to score response")

@app.post("/evaluation/evaluate-response", response_model=EvaluationWithOutcomeResponse)
async def evaluate_response_with_outcome(request: ResponseEvaluationRequest):
    """Enhanced response evaluation with outcomes and path recommendations"""
    try:
        result = await scoring_service.evaluate_response_with_outcome(
            scenario_id=request.scenario_id,
            player_response=request.player_response,
            session_id=request.session_id,
            context=request.context
        )
        return result
    except Exception as e:
        logger.error(f"Enhanced response evaluation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to evaluate response")

@app.post("/scoring/batch-score", response_model=List[ScoringResult])
async def batch_score_responses(requests: List[ScoringRequest]):
    """Score multiple player responses in batch"""
    try:
        results = await scoring_service.batch_score_responses(requests)
        return results
    except Exception as e:
        logger.error(f"Batch scoring failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to score responses")

@app.get("/scenarios/get-scenario", response_model=CuratedScenarioResponse)
async def get_curated_scenario(theme: str = None):
    """Get a curated scenario, optionally filtered by theme (difficulty not used currently)"""
    try:
        # Convert string parameter to enum if provided, default to general
        theme_enum = Theme.GENERAL
        if theme:
            try:
                theme_enum = Theme(theme.lower())
            except ValueError:
                logger.warning(f"Unknown theme '{theme}', using general theme")
                theme_enum = Theme.GENERAL
        
        # Get random scenario from repository
        scenario = await scenario_repository.get_random_scenario(theme_enum)
        
        if not scenario:
            raise HTTPException(status_code=404, detail="No scenarios found")
        
        return CuratedScenarioResponse(
            scenario_id=scenario.scenario_id,
            content=scenario.content,
            theme=scenario.theme,
            difficulty=scenario.difficulty,
            context=None
        )
    except Exception as e:
        logger.error(f"Scenario retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve scenario")

@app.get("/scenarios/stats")
async def get_scenario_stats():
    """Get scenario repository statistics for monitoring"""
    try:
        # Get basic scenario statistics from repository
        count = await scenario_repository.get_scenario_count()
        theme_counts = await scenario_repository.get_theme_counts()
        difficulty_counts = await scenario_repository.get_difficulty_counts()
        
        return {
            "total_scenarios": count,
            "theme_distribution": theme_counts,
            "difficulty_distribution": difficulty_counts,
            "repository_loaded": scenario_repository.is_loaded()
        }
    except Exception as e:
        logger.error(f"Scenario stats retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve scenario stats")

@app.get("/scenarios/loader-status")
async def get_loader_status():
    """Get scenario loader status and configuration"""
    try:
        status = await scenario_loader.get_loader_status()
        return status
    except Exception as e:
        logger.error(f"Loader status retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve loader status")

@app.post("/scenarios/reload")
async def reload_scenarios():
    """Reload scenarios from file"""
    try:
        count = await scenario_loader.reload_scenarios()
        return {"message": f"Successfully reloaded {count} scenarios", "scenario_count": count}
    except Exception as e:
        logger.error(f"Scenario reload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to reload scenarios")

@app.get("/scenarios/validate")
async def validate_scenarios():
    """Validate scenario integrity"""
    try:
        validation_results = await scenario_loader.validate_scenario_integrity()
        return validation_results
    except Exception as e:
        logger.error(f"Scenario validation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate scenarios")

@app.post("/path/next-door")
async def get_next_door_for_player(player_id: str, current_door_id: str, latest_score: float):
    """Get the next door for a player based on their score and current position"""
    try:
        next_door = await scoring_service.get_next_door_for_player(player_id, current_door_id, latest_score)
        if next_door:
            return next_door
        else:
            raise HTTPException(status_code=404, detail="No next door found")
    except Exception as e:
        logger.error(f"Next door retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get next door")

@app.get("/path/progress/{player_id}")
async def get_player_progress(player_id: str):
    """Get comprehensive player progress information"""
    try:
        progress = await scoring_service.calculate_player_progress(player_id)
        return progress
    except Exception as e:
        logger.error(f"Player progress calculation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate player progress")

@app.post("/path/initialize")
async def initialize_player_journey(player_id: str, theme: str, difficulty: str):
    """Initialize a new player's journey in the game"""
    try:
        result = await scoring_service.initialize_player_journey(player_id, theme, difficulty)
        return result
    except Exception as e:
        logger.error(f"Player journey initialization failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize player journey")

@app.get("/evaluation/statistics")
async def get_evaluation_statistics():
    """Get evaluation system statistics and configuration"""
    try:
        stats = await scoring_service.get_evaluation_statistics()
        return stats
    except Exception as e:
        logger.error(f"Evaluation statistics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve evaluation statistics")

@app.get("/config/summary")
async def get_configuration_summary():
    """Get current service configuration summary"""
    try:
        summary = config.get_configuration_summary()
        return summary
    except Exception as e:
        logger.error(f"Configuration summary retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve configuration summary")

@app.get("/config/all")
async def get_all_configuration():
    """Get all configuration values (excluding sensitive data)"""
    try:
        all_config = config.get_all()
        # Remove sensitive information
        safe_config = {k: v for k, v in all_config.items() if "api_key" not in k.lower()}
        return safe_config
    except Exception as e:
        logger.error(f"Configuration retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve configuration")

@app.get("/config/validation")
async def validate_configuration():
    """Validate current service configuration"""
    try:
        validation_result = await _validate_service_configuration()
        return validation_result
    except Exception as e:
        logger.error(f"Configuration validation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate configuration")

@app.post("/config/reload")
async def reload_configuration():
    """Reload and validate service configuration"""
    try:
        # Reload configuration
        from config.environment import EnvironmentConfig
        global config
        config = EnvironmentConfig()
        
        # Validate new configuration
        validation_result = await _validate_service_configuration()
        
        if validation_result["valid"]:
            logger.info("Configuration reloaded and validated successfully")
            return {
                "message": "Configuration reloaded successfully",
                "validation": validation_result,
                "summary": config.get_configuration_summary()
            }
        else:
            logger.warning("Configuration reloaded but validation issues detected")
            return {
                "message": "Configuration reloaded with warnings",
                "validation": validation_result,
                "summary": config.get_configuration_summary()
            }
            
    except Exception as e:
        logger.error(f"Configuration reload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to reload configuration")

@app.post("/config/create-template")
async def create_env_template():
    """Create environment configuration template file"""
    try:
        success = config.create_env_file_template()
        if success:
            return {"message": "Environment template created successfully", "file": ".env.template"}
        else:
            raise HTTPException(status_code=500, detail="Failed to create environment template")
    except Exception as e:
        logger.error(f"Template creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create environment template")

@app.get("/service/status")
async def get_service_status():
    """Get comprehensive service status including initialization state"""
    try:
        # Get component statuses
        scenario_count = await scenario_repository.get_scenario_count()
        loader_status = await scenario_loader.get_loader_status()
        
        # Test AI connectivity
        ai_validation = await _validate_ai_connectivity()
        
        # Get configuration validation
        config_validation = await _validate_service_configuration()
        
        # Determine overall service health
        service_health = "healthy"
        if not ai_validation["connected"]:
            service_health = "degraded"
        if not config_validation["valid"]:
            service_health = "unhealthy" if config_validation["critical_errors"] else "degraded"
        if scenario_count == 0:
            service_health = "unhealthy"
        
        return {
            "service_health": service_health,
            "initialization_complete": True,
            "scenario_status": {
                "loaded": scenario_count > 0,
                "count": scenario_count,
                "loader_status": loader_status
            },
            "ai_status": ai_validation,
            "configuration_status": config_validation,
            "service_info": {
                "version": "2.0.0",
                "uptime_check": "ok"
            }
        }
        
    except Exception as e:
        logger.error(f"Service status check failed: {e}")
        return {
            "service_health": "error",
            "initialization_complete": False,
            "error": str(e)
        }

@app.get("/analytics/{player_id}")
async def get_player_analytics(player_id: str):
    """Get detailed scoring analytics for a player"""
    try:
        analytics = await scoring_service.get_scoring_analytics(player_id)
        return analytics
    except Exception as e:
        logger.error(f"Analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve player analytics")

if __name__ == "__main__":
    import uvicorn
    port = config.get("port", 8000)
    logger.info(f"Starting AI Service on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)