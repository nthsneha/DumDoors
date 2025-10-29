import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class EnvironmentConfig:
    """Configuration manager for environment variables"""
    
    def __init__(self):
        self.config = self._load_configuration()
        self._validate_configuration()
    
    def _load_configuration(self) -> Dict[str, Any]:
        """Load configuration from environment variables"""
        return {
            # AI Provider Configuration
            "ai_provider": os.getenv("AI_PROVIDER", "gemini"),
            "gemini_api_key": os.getenv("GEMINI_API_KEY"),
            "gemini_model": os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
            
            # Vertex AI Configuration
            "vertex_ai_project_id": os.getenv("VERTEX_AI_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT"),
            "vertex_ai_location": os.getenv("VERTEX_AI_LOCATION", "us-central1"),
            
            # Scenario Management
            "curated_scenarios_file_path": os.getenv("CURATED_SCENARIOS_FILE_PATH", "data/scenarios.jsonl"),
            "scenario_backup_file_path": os.getenv("SCENARIO_BACKUP_FILE_PATH", "data/scenarios_backup.jsonl"),
            "scenario_reload_interval": int(os.getenv("SCENARIO_RELOAD_INTERVAL", "3600")),
            
            # Scoring Thresholds
            "score_threshold_poor_max": float(os.getenv("SCORE_THRESHOLD_POOR_MAX", "30")),
            "score_threshold_excellent_min": float(os.getenv("SCORE_THRESHOLD_EXCELLENT_MIN", "70")),
            "comparison_weight": float(os.getenv("COMPARISON_WEIGHT", "0.6")),
            "reasoning_weight": float(os.getenv("REASONING_WEIGHT", "0.4")),
            
            # Path Configuration
            "min_path_nodes": int(os.getenv("MIN_PATH_NODES", "3")),
            "max_path_nodes": int(os.getenv("MAX_PATH_NODES", "10")),
            "default_path_nodes": int(os.getenv("DEFAULT_PATH_NODES", "6")),
            
            # Outcome Generation
            "outcome_exaggeration_level": os.getenv("OUTCOME_EXAGGERATION_LEVEL", "high"),
            "outcome_appropriateness_check": os.getenv("OUTCOME_APPROPRIATENESS_CHECK", "true").lower() == "true",
            
            # Performance
            "evaluation_timeout_seconds": int(os.getenv("EVALUATION_TIMEOUT_SECONDS", "5")),
            "max_concurrent_evaluations": int(os.getenv("MAX_CONCURRENT_EVALUATIONS", "20")),
            "cache_scenarios_in_memory": os.getenv("CACHE_SCENARIOS_IN_MEMORY", "true").lower() == "true",
            
            # Service Configuration
            "port": int(os.getenv("PORT", "8000")),
            "log_level": os.getenv("LOG_LEVEL", "INFO"),
        }
    
    def _validate_configuration(self):
        """Validate configuration values with enhanced error handling"""
        errors = []
        warnings = []
        critical_errors = []
        
        # Validate AI provider configuration
        ai_provider = self.config["ai_provider"].lower()
        
        if ai_provider == "gemini":
            if not self.config.get("gemini_api_key"):
                critical_errors.append("GEMINI_API_KEY is required for Gemini provider")
        elif ai_provider in ["vertex_ai", "vertexai"]:
            if not self.config.get("vertex_ai_project_id"):
                critical_errors.append("VERTEX_AI_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required for Vertex AI provider")
        elif ai_provider != "mock":
            errors.append(f"Unsupported AI provider: {self.config['ai_provider']}. Supported: gemini, vertex_ai, mock")
        
        # Validate scoring weights
        weight_sum = self.config["comparison_weight"] + self.config["reasoning_weight"]
        if abs(weight_sum - 1.0) > 0.01:
            warnings.append(f"Scoring weights sum to {weight_sum}, not 1.0 - auto-correcting")
            # Auto-correct weights
            total = self.config["comparison_weight"] + self.config["reasoning_weight"]
            self.config["comparison_weight"] = self.config["comparison_weight"] / total
            self.config["reasoning_weight"] = self.config["reasoning_weight"] / total
        
        # Validate score thresholds
        if self.config["score_threshold_poor_max"] >= self.config["score_threshold_excellent_min"]:
            errors.append("Poor threshold must be less than excellent threshold")
        
        if not (0 <= self.config["score_threshold_poor_max"] <= 100):
            errors.append("Poor threshold must be between 0 and 100")
        
        if not (0 <= self.config["score_threshold_excellent_min"] <= 100):
            errors.append("Excellent threshold must be between 0 and 100")
        
        # Validate path configuration
        if self.config["min_path_nodes"] <= 0:
            errors.append("MIN_PATH_NODES must be positive")
        
        if self.config["max_path_nodes"] <= self.config["min_path_nodes"]:
            errors.append("MAX_PATH_NODES must be greater than MIN_PATH_NODES")
        
        if not (self.config["min_path_nodes"] <= self.config["default_path_nodes"] <= self.config["max_path_nodes"]):
            errors.append("DEFAULT_PATH_NODES must be between MIN and MAX path nodes")
        
        # Validate performance configuration
        if self.config["evaluation_timeout_seconds"] <= 0:
            errors.append("EVALUATION_TIMEOUT_SECONDS must be positive")
        
        if self.config["max_concurrent_evaluations"] <= 0:
            errors.append("MAX_CONCURRENT_EVALUATIONS must be positive")
        
        # Validate scenario file paths
        scenario_path = self.config["curated_scenarios_file_path"]
        backup_path = self.config["scenario_backup_file_path"]
        
        if not os.path.exists(scenario_path) and not os.path.exists(backup_path):
            warnings.append(f"Neither primary scenario file ({scenario_path}) nor backup ({backup_path}) exists")
        
        # Validate outcome configuration
        if self.config["outcome_exaggeration_level"] not in ["low", "medium", "high"]:
            warnings.append(f"Invalid exaggeration level: {self.config['outcome_exaggeration_level']} - defaulting to 'high'")
            self.config["outcome_exaggeration_level"] = "high"
        
        # Store validation results for later access
        self._validation_results = {
            "errors": errors,
            "warnings": warnings,
            "critical_errors": critical_errors,
            "valid": len(errors) == 0 and len(critical_errors) == 0
        }
        
        # Log validation results
        if critical_errors:
            for error in critical_errors:
                logger.critical(f"Critical configuration error: {error}")
        
        if errors:
            for error in errors:
                logger.error(f"Configuration error: {error}")
        
        if warnings:
            for warning in warnings:
                logger.warning(f"Configuration warning: {warning}")
        
        # Only raise exception for critical errors
        if critical_errors:
            raise ValueError(f"Critical configuration errors: {'; '.join(critical_errors)}")
        
        if errors:
            logger.error(f"Configuration has {len(errors)} errors but continuing with fallbacks")
        else:
            logger.info("Configuration validation passed")
    
    def get_validation_results(self) -> Dict[str, Any]:
        """Get the results of the last configuration validation"""
        return getattr(self, '_validation_results', {
            "errors": [],
            "warnings": [],
            "critical_errors": [],
            "valid": True
        })
    
    def apply_fallback_configuration(self) -> Dict[str, Any]:
        """Apply fallback configuration for missing or invalid values"""
        try:
            fallbacks_applied = []
            
            # Apply scoring weight fallbacks
            if abs((self.config["comparison_weight"] + self.config["reasoning_weight"]) - 1.0) > 0.01:
                self.config["comparison_weight"] = 0.6
                self.config["reasoning_weight"] = 0.4
                fallbacks_applied.append("scoring_weights")
            
            # Apply threshold fallbacks
            if self.config["score_threshold_poor_max"] >= self.config["score_threshold_excellent_min"]:
                self.config["score_threshold_poor_max"] = 30.0
                self.config["score_threshold_excellent_min"] = 70.0
                fallbacks_applied.append("score_thresholds")
            
            # Apply path configuration fallbacks
            if self.config["max_path_nodes"] <= self.config["min_path_nodes"]:
                self.config["min_path_nodes"] = 3
                self.config["max_path_nodes"] = 10
                self.config["default_path_nodes"] = 6
                fallbacks_applied.append("path_configuration")
            
            # Apply performance fallbacks
            if self.config["evaluation_timeout_seconds"] <= 0:
                self.config["evaluation_timeout_seconds"] = 5
                fallbacks_applied.append("evaluation_timeout")
            
            if self.config["max_concurrent_evaluations"] <= 0:
                self.config["max_concurrent_evaluations"] = 20
                fallbacks_applied.append("max_concurrent_evaluations")
            
            logger.info(f"Applied fallback configuration for: {fallbacks_applied}")
            
            return {
                "success": True,
                "fallbacks_applied": fallbacks_applied,
                "message": f"Applied {len(fallbacks_applied)} fallback configurations"
            }
            
        except Exception as e:
            logger.error(f"Failed to apply fallback configuration: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to apply fallback configuration"
            }
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value"""
        return self.config.get(key, default)
    
    def get_all(self) -> Dict[str, Any]:
        """Get all configuration values"""
        return self.config.copy()
    
    def get_ai_config(self) -> Dict[str, Any]:
        """Get AI provider configuration"""
        return {
            "provider": self.config["ai_provider"],
            "gemini_api_key": self.config["gemini_api_key"],
            "gemini_model": self.config["gemini_model"]
        }
    
    def get_scoring_config(self) -> Dict[str, Any]:
        """Get scoring configuration"""
        return {
            "score_threshold_poor_max": self.config["score_threshold_poor_max"],
            "score_threshold_excellent_min": self.config["score_threshold_excellent_min"],
            "comparison_weight": self.config["comparison_weight"],
            "reasoning_weight": self.config["reasoning_weight"]
        }
    
    def get_path_config(self) -> Dict[str, Any]:
        """Get path configuration"""
        return {
            "min_path_nodes": self.config["min_path_nodes"],
            "max_path_nodes": self.config["max_path_nodes"],
            "default_path_nodes": self.config["default_path_nodes"]
        }
    
    def get_outcome_config(self) -> Dict[str, Any]:
        """Get outcome generation configuration"""
        return {
            "outcome_exaggeration_level": self.config["outcome_exaggeration_level"],
            "outcome_appropriateness_check": self.config["outcome_appropriateness_check"]
        }
    
    def get_scenario_config(self) -> Dict[str, Any]:
        """Get scenario management configuration"""
        return {
            "curated_scenarios_file_path": self.config["curated_scenarios_file_path"],
            "scenario_backup_file_path": self.config["scenario_backup_file_path"],
            "scenario_reload_interval": self.config["scenario_reload_interval"],
            "cache_scenarios_in_memory": self.config["cache_scenarios_in_memory"]
        }
    
    def get_performance_config(self) -> Dict[str, Any]:
        """Get performance configuration"""
        return {
            "evaluation_timeout_seconds": self.config["evaluation_timeout_seconds"],
            "max_concurrent_evaluations": self.config["max_concurrent_evaluations"]
        }
    
    def update_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update configuration values"""
        try:
            old_config = self.config.copy()
            
            # Apply updates
            for key, value in updates.items():
                if key in self.config:
                    self.config[key] = value
                else:
                    logger.warning(f"Unknown configuration key: {key}")
            
            # Re-validate
            self._validate_configuration()
            
            logger.info(f"Configuration updated successfully")
            
            return {
                "success": True,
                "updated_keys": list(updates.keys()),
                "old_config": old_config,
                "new_config": self.config.copy()
            }
            
        except Exception as e:
            # Restore old configuration on error
            self.config = old_config
            logger.error(f"Configuration update failed: {e}")
            
            return {
                "success": False,
                "error": str(e),
                "current_config": self.config.copy()
            }
    
    def create_env_file_template(self, file_path: str = ".env.template") -> bool:
        """Create a template .env file with all configuration options"""
        try:
            template_content = """# AI Service Configuration Template

# AI Provider Configuration
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Scenario Management
CURATED_SCENARIOS_FILE_PATH=data/scenarios.jsonl
SCENARIO_BACKUP_FILE_PATH=data/scenarios_backup.jsonl
SCENARIO_RELOAD_INTERVAL=3600

# Scoring Thresholds
SCORE_THRESHOLD_POOR_MAX=30
SCORE_THRESHOLD_EXCELLENT_MIN=70
COMPARISON_WEIGHT=0.6
REASONING_WEIGHT=0.4

# Path Configuration
MIN_PATH_NODES=3
MAX_PATH_NODES=10
DEFAULT_PATH_NODES=6

# Outcome Generation
OUTCOME_EXAGGERATION_LEVEL=high
OUTCOME_APPROPRIATENESS_CHECK=true

# Performance
EVALUATION_TIMEOUT_SECONDS=5
MAX_CONCURRENT_EVALUATIONS=20
CACHE_SCENARIOS_IN_MEMORY=true

# Service Configuration
PORT=8000
LOG_LEVEL=INFO
"""
            
            with open(file_path, 'w') as f:
                f.write(template_content)
            
            logger.info(f"Created environment template file: {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create environment template: {e}")
            return False
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration including validation status"""
        validation_results = self.get_validation_results()
        
        return {
            "validation_status": {
                "valid": validation_results["valid"],
                "errors": len(validation_results["errors"]),
                "warnings": len(validation_results["warnings"]),
                "critical_errors": len(validation_results["critical_errors"])
            },
            "ai_provider": {
                "provider": self.config["ai_provider"],
                "model": self.config["gemini_model"],
                "api_key_configured": bool(self.config["gemini_api_key"]) if self.config["ai_provider"] == "gemini" else None,
                "vertex_project_configured": bool(self.config["vertex_ai_project_id"]) if self.config["ai_provider"] in ["vertex_ai", "vertexai"] else None,
                "vertex_location": self.config.get("vertex_ai_location") if self.config["ai_provider"] in ["vertex_ai", "vertexai"] else None
            },
            "scoring": {
                "poor_threshold": self.config["score_threshold_poor_max"],
                "excellent_threshold": self.config["score_threshold_excellent_min"],
                "comparison_weight": self.config["comparison_weight"],
                "reasoning_weight": self.config["reasoning_weight"]
            },
            "path_management": {
                "min_nodes": self.config["min_path_nodes"],
                "max_nodes": self.config["max_path_nodes"],
                "default_nodes": self.config["default_path_nodes"]
            },
            "outcome_generation": {
                "exaggeration_level": self.config["outcome_exaggeration_level"],
                "appropriateness_check": self.config["outcome_appropriateness_check"]
            },
            "scenarios": {
                "file_path": self.config["curated_scenarios_file_path"],
                "backup_path": self.config["scenario_backup_file_path"],
                "cache_enabled": self.config["cache_scenarios_in_memory"],
                "primary_exists": os.path.exists(self.config["curated_scenarios_file_path"]),
                "backup_exists": os.path.exists(self.config["scenario_backup_file_path"])
            },
            "performance": {
                "timeout_seconds": self.config["evaluation_timeout_seconds"],
                "max_concurrent": self.config["max_concurrent_evaluations"]
            }
        }

# Global configuration instance - will be initialized when needed
config = None

def get_config() -> EnvironmentConfig:
    """Get or create the global configuration instance"""
    global config
    if config is None:
        config = EnvironmentConfig()
    return config

# For backward compatibility
def __getattr__(name):
    """Allow direct access to config attributes"""
    if name == 'config':
        return get_config()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")