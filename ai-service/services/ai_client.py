import os
import asyncio
import logging
from typing import Dict, Any, Optional, List
from abc import ABC, abstractmethod

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

try:
    from google.cloud import aiplatform
    from vertexai.preview.generative_models import GenerativeModel
    import vertexai
    import json
    VERTEX_AI_AVAILABLE = True
except ImportError:
    VERTEX_AI_AVAILABLE = False
    aiplatform = None
    GenerativeModel = None
    vertexai = None
    json = None

from models.door import AIClientConfig, Theme, DifficultyLevel

logger = logging.getLogger(__name__)

class BaseAIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @abstractmethod
    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        """Generate text using the AI provider"""
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check if the AI provider is available"""
        pass

class GeminiProvider(BaseAIProvider):
    """Google Gemini provider implementation (direct API)"""
    
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        if not GEMINI_AVAILABLE:
            raise ImportError("google-generativeai package not available")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)
        self.model_name = model
    
    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        try:
            # Configure generation parameters for Gemini API
            generation_config = genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
                top_p=0.95,
                top_k=40,
            )
            
            # Generate response using asyncio.to_thread for sync API
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config=generation_config
            )
            
            return response.text.strip()
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        try:
            # Simple test request
            generation_config = genai.types.GenerationConfig(max_output_tokens=1)
            response = await asyncio.to_thread(
                self.model.generate_content,
                "test",
                generation_config=generation_config
            )
            return {"status": "healthy", "provider": "gemini", "model": self.model_name}
        except Exception as e:
            return {"status": "unhealthy", "provider": "gemini", "error": str(e)}

class VertexAIProvider(BaseAIProvider):
    """Google Vertex AI provider implementation"""
    
    def __init__(self, project_id: str, location: str = "us-central1", model: str = "gemini-1.5-flash"):
        if not VERTEX_AI_AVAILABLE:
            raise ImportError("google-cloud-aiplatform package not available")
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        aiplatform.init(project=project_id, location=location)
        
        # Handle custom model paths vs standard model names
        if model.startswith("projects/"):
            # Custom model with full path
            logger.info(f"Using full model path: {model}")
            self.model = aiplatform.Model(model)
        elif model.isdigit():
            # Custom model ID - use aiplatform.Model for custom models
            full_model_path = f"projects/{project_id}/locations/{location}/models/{model}"
            logger.info(f"Using custom model path: {full_model_path}")
            self.model = aiplatform.Model(full_model_path)
        else:
            # Standard model name - use GenerativeModel
            logger.info(f"Using standard model: {model}")
            self.model = GenerativeModel(model)
        self.model_name = model
        self.project_id = project_id
        self.location = location
        self.is_custom_model = model.isdigit() or model.startswith("projects/")
    
    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        try:
            if self.is_custom_model:
                # For custom models using aiplatform.Model
                # Use predict method for custom models
                instances = [{"prompt": prompt}]
                parameters = {
                    "max_output_tokens": max_tokens,
                    "temperature": temperature,
                }
                
                response = await asyncio.to_thread(
                    self.model.predict,
                    instances=instances,
                    parameters=parameters
                )
                
                # Extract text from prediction response
                if response.predictions and len(response.predictions) > 0:
                    prediction = response.predictions[0]
                    if isinstance(prediction, dict) and 'content' in prediction:
                        return prediction['content'].strip()
                    elif isinstance(prediction, str):
                        return prediction.strip()
                    else:
                        return str(prediction).strip()
                else:
                    raise Exception("No predictions returned from custom model")
            else:
                # For standard models using GenerativeModel
                generation_config = {
                    "max_output_tokens": max_tokens,
                    "temperature": temperature,
                }
                
                response = await asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    generation_config=generation_config
                )
                
                return response.text.strip()
        except Exception as e:
            logger.error(f"Vertex AI generation failed: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        try:
            if self.is_custom_model:
                # For custom models using aiplatform.Model
                instances = [{"prompt": "test"}]
                parameters = {"max_output_tokens": 1, "temperature": 0.1}
                
                response = await asyncio.to_thread(
                    self.model.predict,
                    instances=instances,
                    parameters=parameters
                )
                return {"status": "healthy", "provider": "vertex_ai", "model": self.model_name, "project": self.project_id, "type": "custom"}
            else:
                # For standard models using GenerativeModel
                generation_config = {
                    "max_output_tokens": 1,
                    "temperature": 0.1
                }
                
                response = await asyncio.to_thread(
                    self.model.generate_content,
                    "test",
                    generation_config=generation_config
                )
                return {"status": "healthy", "provider": "vertex_ai", "model": self.model_name, "project": self.project_id, "type": "standard"}
        except Exception as e:
            return {"status": "unhealthy", "provider": "vertex_ai", "error": str(e)}

class VertexAIEndpointProvider(BaseAIProvider):
    """Vertex AI Endpoint provider for deployed custom models"""
    
    def __init__(self, project_id: str, location: str, endpoint_id: str, deployed_model_id: str):
        if not VERTEX_AI_AVAILABLE:
            raise ImportError("google-cloud-aiplatform package not available")
        
        # Initialize Vertex AI
        aiplatform.init(project=project_id, location=location)
        
        self.project_id = project_id
        self.location = location
        self.endpoint_id = endpoint_id
        self.deployed_model_id = deployed_model_id
        
        # Get the endpoint
        self.endpoint = aiplatform.Endpoint(endpoint_id)
        
        logger.info(f"Initialized Vertex AI Endpoint: {endpoint_id}")
        logger.info(f"Deployed Model ID: {deployed_model_id}")
    
    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        try:
            # Prepare the request body for the deployed model
            # For Gemini models, the format is usually different
            instances = [
                {
                    "content": prompt
                }
            ]
            
            # Make the request using asyncio.to_thread for the sync API
            response = await asyncio.to_thread(
                self.endpoint.predict,
                instances=instances
            )
            
            # Parse the response
            if hasattr(response, 'predictions') and response.predictions:
                # Get the first prediction
                prediction = response.predictions[0]
                
                # Handle different response formats
                if isinstance(prediction, dict):
                    # Try different possible keys for the generated text
                    for key in ['content', 'generated_text', 'text', 'output', 'response']:
                        if key in prediction:
                            return str(prediction[key]).strip()
                    
                    # If no known key, return the whole prediction as string
                    return str(prediction).strip()
                
                elif isinstance(prediction, str):
                    return prediction.strip()
                
                else:
                    return str(prediction).strip()
            
            # If no predictions, return the raw response
            return str(response).strip()
            
        except Exception as e:
            logger.error(f"Vertex AI Endpoint generation failed: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        try:
            # Simple test request
            test_response = await self.generate_text("test", max_tokens=1, temperature=0.1)
            return {
                "status": "healthy", 
                "provider": "vertex_ai_endpoint", 
                "endpoint_id": self.endpoint_id,
                "deployed_model_id": self.deployed_model_id,
                "project": self.project_id
            }
        except Exception as e:
            return {
                "status": "unhealthy", 
                "provider": "vertex_ai_endpoint", 
                "error": str(e),
                "endpoint_id": self.endpoint_id
            }

class MockAIProvider(BaseAIProvider):
    """Mock AI provider for testing and fallback"""
    
    def __init__(self):
        self.call_count = 0
    
    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        self.call_count += 1
        
        # Simple mock responses based on prompt content
        if "door" in prompt.lower() and "scenario" in prompt.lower():
            return "You find yourself in a mysterious room with three doors. Each door has a different symbol: a key, a clock, and a question mark. You must choose one to proceed, but you can hear strange sounds coming from behind each door."
        
        if "score" in prompt.lower() and "response" in prompt.lower():
            return "75"  # Mock score
        
        return "Mock AI response generated successfully."
    
    async def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy", 
            "provider": "mock", 
            "calls_made": self.call_count
        }

class AIClient:
    """Main AI client that manages different providers"""
    
    def __init__(self):
        self.provider = self._initialize_provider()
        self.fallback_provider = MockAIProvider()
    
    def _initialize_provider(self) -> BaseAIProvider:
        """Initialize the AI provider based on environment configuration"""
        provider_type = os.getenv("AI_PROVIDER", "gemini").lower()
        
        if provider_type == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                logger.warning("Gemini API key not found, falling back to mock provider")
                return MockAIProvider()
            model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            return GeminiProvider(api_key, model)
        
        elif provider_type == "vertex_ai" or provider_type == "vertexai":
            project_id = os.getenv("VERTEX_AI_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
            if not project_id:
                logger.warning("Vertex AI project ID not found, falling back to mock provider")
                return MockAIProvider()
            
            location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
            model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            
            try:
                return VertexAIProvider(project_id, location, model)
            except ImportError as e:
                logger.error(f"Vertex AI dependencies not available: {e}")
                return MockAIProvider()
            except Exception as e:
                logger.error(f"Failed to initialize Vertex AI: {e}")
                return MockAIProvider()
        
        elif provider_type == "vertex_ai_endpoint":
            project_id = os.getenv("VERTEX_AI_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
            endpoint_id = os.getenv("VERTEX_AI_ENDPOINT_ID")
            deployed_model_id = os.getenv("DEPLOYED_MODEL_ID")
            
            if not project_id or not endpoint_id or not deployed_model_id:
                logger.warning("Vertex AI Endpoint configuration incomplete, falling back to mock provider")
                logger.warning(f"Missing: project_id={bool(project_id)}, endpoint_id={bool(endpoint_id)}, deployed_model_id={bool(deployed_model_id)}")
                return MockAIProvider()
            
            location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
            
            try:
                return VertexAIEndpointProvider(project_id, location, endpoint_id, deployed_model_id)
            except ImportError as e:
                logger.error(f"Vertex AI dependencies not available: {e}")
                return MockAIProvider()
            except Exception as e:
                logger.error(f"Failed to initialize Vertex AI Endpoint: {e}")
                return MockAIProvider()
        
        else:
            logger.info("Using mock AI provider")
            return MockAIProvider()
    
    async def generate_door_scenario(self, theme: Theme, difficulty: DifficultyLevel, context: Optional[Dict[str, Any]] = None) -> str:
        """Generate a door scenario using the AI provider"""
        prompt = self._build_door_prompt(theme, difficulty, context)
        
        try:
            return await self.provider.generate_text(prompt, max_tokens=500, temperature=0.8)
        except Exception as e:
            logger.error(f"Primary AI provider failed, using fallback: {e}")
            return await self.fallback_provider.generate_text(prompt, max_tokens=500, temperature=0.8)
    
    async def generate_unique_door_scenario(self, theme: Theme, difficulty: DifficultyLevel, 
                                          previous_scenarios: List[str], 
                                          context: Optional[Dict[str, Any]] = None) -> str:
        """Generate a unique door scenario that differs from previous scenarios"""
        prompt = self._build_unique_door_prompt(theme, difficulty, previous_scenarios, context)
        
        # Use higher temperature and creativity settings for unique content
        temperature = 0.9
        max_tokens = 600
        
        try:
            return await self.provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
        except Exception as e:
            logger.error(f"Primary AI provider failed for unique scenario, using fallback: {e}")
            return await self.fallback_provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
    
    async def generate_scenario_variations(self, base_scenario: str, theme: Theme, 
                                         difficulty: DifficultyLevel, 
                                         variation_count: int = 3) -> List[str]:
        """Generate multiple variations of a scenario for diversity"""
        prompt = self._build_variation_prompt(base_scenario, theme, difficulty, variation_count)
        
        # Use high creativity settings for variations
        temperature = 0.95
        max_tokens = 800
        
        try:
            result = await self.provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
            return self._parse_scenario_variations(result, variation_count)
        except Exception as e:
            logger.error(f"Primary AI provider failed for variations, using fallback: {e}")
            result = await self.fallback_provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
            return self._parse_scenario_variations(result, variation_count)
    
    async def generate_exaggerated_positive_outcome(self, scenario: str, response: str, 
                                                  score: float, context: Optional[Dict[str, Any]] = None) -> str:
        """Generate an exaggerated positive outcome for high-scoring responses"""
        prompt = self._build_positive_outcome_prompt(scenario, response, score, context)
        
        # Use high creativity for dramatic outcomes
        temperature = 0.85
        max_tokens = 400
        
        try:
            return await self.provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
        except Exception as e:
            logger.error(f"Primary AI provider failed for positive outcome, using fallback: {e}")
            return await self.fallback_provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
    
    async def generate_exaggerated_negative_outcome(self, scenario: str, response: str, 
                                                  score: float, context: Optional[Dict[str, Any]] = None) -> str:
        """Generate an exaggerated negative outcome for low-scoring responses"""
        prompt = self._build_negative_outcome_prompt(scenario, response, score, context)
        
        # Use high creativity for dramatic outcomes
        temperature = 0.85
        max_tokens = 400
        
        try:
            return await self.provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
        except Exception as e:
            logger.error(f"Primary AI provider failed for negative outcome, using fallback: {e}")
            return await self.fallback_provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
    
    async def validate_outcome_appropriateness(self, outcome: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Validate that an outcome is appropriate for all audiences"""
        prompt = self._build_appropriateness_validation_prompt(outcome, context)
        
        # Use lower temperature for consistent validation
        temperature = 0.3
        max_tokens = 200
        
        try:
            result = await self.provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
            return self._parse_appropriateness_result(result)
        except Exception as e:
            logger.error(f"Primary AI provider failed for appropriateness validation, using fallback: {e}")
            result = await self.fallback_provider.generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
            return self._parse_appropriateness_result(result)
    
    async def compare_responses(self, player_response: str, expected_answer: str) -> float:
        """Compare player response with expected answer using AI"""
        prompt = self._build_answer_comparison_prompt(player_response, expected_answer)
        
        try:
            result = await self.provider.generate_text(prompt, max_tokens=100, temperature=0.3)
            score = self._extract_numeric_score(result)
            return score if score is not None else 50.0
        except Exception as e:
            logger.error(f"Answer comparison failed: {e}")
            return 50.0
    
    async def analyze_reasoning_quality(self, response: str, scenario: str) -> float:
        """Analyze reasoning quality using AI"""
        prompt = self._build_reasoning_analysis_prompt(response, scenario)
        
        try:
            result = await self.provider.generate_text(prompt, max_tokens=100, temperature=0.3)
            score = self._extract_numeric_score(result)
            return score if score is not None else 50.0
        except Exception as e:
            logger.error(f"Reasoning analysis failed: {e}")
            return 50.0
    
    async def generate_outcome(self, scenario: str, response: str, score: float, outcome_type: str) -> str:
        """Generate exaggerated outcome based on score and type"""
        if outcome_type == "excellent":
            prompt = self._build_excellent_outcome_prompt(scenario, response, score)
        elif outcome_type == "poor":
            prompt = self._build_poor_outcome_prompt(scenario, response, score)
        else:  # average
            prompt = self._build_average_outcome_prompt(scenario, response, score)
        
        try:
            result = await self.provider.generate_text(prompt, max_tokens=300, temperature=0.8)
            return result.strip()
        except Exception as e:
            logger.error(f"Outcome generation failed: {e}")
            return self._get_fallback_outcome(outcome_type)

    async def score_response_with_outcome(self, door_content: str, response: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Score a player response and generate exaggerated outcome"""
        prompt = self._build_scoring_with_outcome_prompt(door_content, response, context)
        
        try:
            result = await self.provider.generate_text(prompt, max_tokens=3000, temperature=0.8)
            return self._parse_scoring_with_outcome_result(result)
        except Exception as e:
            logger.error(f"Primary AI provider failed for scoring, using fallback: {e}")
            result = await self.fallback_provider.generate_text(prompt, max_tokens=3000, temperature=0.8)
            return self._parse_scoring_with_outcome_result(result)

    async def score_response(self, door_content: str, response: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
        """Score a player response using the AI provider (legacy method)"""
        prompt = self._build_scoring_prompt(door_content, response, context)
        
        try:
            result = await self.provider.generate_text(prompt, max_tokens=300, temperature=0.3)
            return self._parse_scoring_result(result)
        except Exception as e:
            logger.error(f"Primary AI provider failed for scoring, using fallback: {e}")
            result = await self.fallback_provider.generate_text(prompt, max_tokens=300, temperature=0.3)
            return self._parse_scoring_result(result)
    
    async def health_check(self) -> Dict[str, Any]:
        """Check the health of the AI client"""
        primary_health = await self.provider.health_check()
        fallback_health = await self.fallback_provider.health_check()
        
        return {
            "primary": primary_health,
            "fallback": fallback_health,
            "overall_status": "healthy" if primary_health["status"] == "healthy" else "degraded"
        }
    
    def _build_door_prompt(self, theme: Theme, difficulty: DifficultyLevel, context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for door scenario generation"""
        base_prompt = f"""Generate a creative and engaging door scenario for a game called DumDoors.

Theme: {theme.value}
Difficulty: {difficulty.value}

Requirements:
- Create a situation that requires creative problem-solving
- The scenario should be {difficulty.value} difficulty level
- Keep it appropriate for all audiences
- Make it engaging and thought-provoking
- The scenario should be 2-3 sentences long
- Focus on the {theme.value} theme

"""
        
        if context:
            base_prompt += f"Additional context: {context}\n"
        
        base_prompt += "Generate only the door scenario text, no additional formatting or explanation."
        
        return base_prompt
    
    def _build_unique_door_prompt(self, theme: Theme, difficulty: DifficultyLevel, 
                                previous_scenarios: List[str], 
                                context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for unique door scenario generation with uniqueness constraints"""
        base_prompt = f"""Generate a completely unique and creative door scenario for a game called DumDoors.

Theme: {theme.value}
Difficulty: {difficulty.value}

CRITICAL UNIQUENESS REQUIREMENTS:
- The scenario MUST be completely different from all previously generated scenarios
- Avoid similar plot elements, settings, characters, or situations
- Use fresh creative angles and unexpected twists
- Ensure no repetition of themes, objects, or narrative elements

Previously generated scenarios to AVOID similarity with:
"""
        
        # Add previous scenarios with clear separation
        for i, scenario in enumerate(previous_scenarios[-10:], 1):  # Limit to last 10 for prompt efficiency
            base_prompt += f"{i}. {scenario}\n"
        
        base_prompt += f"""

GENERATION REQUIREMENTS:
- Create a completely original situation that requires creative problem-solving
- The scenario should be {difficulty.value} difficulty level
- Keep it appropriate for all audiences
- Make it highly engaging and thought-provoking
- The scenario should be 2-3 sentences long
- Focus on the {theme.value} theme
- Use maximum creativity and originality
- Introduce novel elements not seen in previous scenarios

"""
        
        if context:
            base_prompt += f"Additional context: {context}\n"
        
        base_prompt += """
UNIQUENESS VALIDATION:
Before finalizing, ensure your scenario:
1. Uses different setting/location than previous scenarios
2. Introduces new characters or entities
3. Presents a novel problem or challenge
4. Employs fresh narrative elements

Generate only the unique door scenario text, no additional formatting or explanation."""
        
        return base_prompt
    
    def _build_variation_prompt(self, base_scenario: str, theme: Theme, 
                              difficulty: DifficultyLevel, variation_count: int) -> str:
        """Build a prompt for generating scenario variations"""
        prompt = f"""Generate {variation_count} creative variations of the following door scenario while maintaining the core theme and difficulty.

Original Scenario: {base_scenario}

Theme: {theme.value}
Difficulty: {difficulty.value}

VARIATION REQUIREMENTS:
- Each variation should tell the same basic story but with different details
- Change settings, characters, objects, or specific circumstances
- Maintain the {difficulty.value} difficulty level
- Keep the {theme.value} theme consistent
- Each variation should be 2-3 sentences long
- Make each variation feel fresh and engaging
- Ensure variations are distinct from each other

Format your response as:
Variation 1: [scenario text]
Variation 2: [scenario text]
Variation 3: [scenario text]
{f'Variation {variation_count}: [scenario text]' if variation_count > 3 else ''}

Generate only the variations in the specified format, no additional text."""
        
        return prompt
    
    def _build_positive_outcome_prompt(self, scenario: str, response: str, score: float, 
                                     context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for generating exaggerated positive outcomes"""
        prompt = f"""Generate a dramatically exaggerated POSITIVE outcome for this door scenario game response.

Original Scenario: {scenario}

Player Response: {response}

Player Score: {score}/100 (HIGH SCORE - Excellent response!)

POSITIVE OUTCOME REQUIREMENTS:
- Create an over-the-top, dramatically positive result
- Make it entertaining and engaging while staying appropriate for all audiences
- The outcome should logically connect to both the scenario and the player's response
- Use exaggerated language and dramatic flair
- Make the player feel like a hero or genius
- Include unexpected positive consequences
- Keep it 2-4 sentences long
- Make it celebratory and triumphant

TONE: Enthusiastic, dramatic, celebratory, engaging
STYLE: Over-the-top positive, like a movie trailer or epic victory

"""
        
        if context:
            prompt += f"Additional context: {context}\n"
        
        prompt += "Generate only the exaggerated positive outcome text, no additional formatting or explanation."
        
        return prompt
    
    def _build_negative_outcome_prompt(self, scenario: str, response: str, score: float, 
                                     context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for generating exaggerated negative outcomes"""
        prompt = f"""Generate a dramatically exaggerated NEGATIVE outcome for this door scenario game response.

Original Scenario: {scenario}

Player Response: {response}

Player Score: {score}/100 (LOW SCORE - Needs improvement!)

NEGATIVE OUTCOME REQUIREMENTS:
- Create an over-the-top, dramatically negative result
- Make it entertaining and engaging while staying appropriate for all audiences
- The outcome should logically connect to both the scenario and the player's response
- Use exaggerated language and dramatic flair
- Make it comically disastrous but not mean-spirited
- Include unexpected negative consequences
- Keep it 2-4 sentences long
- Make it dramatic but still fun and engaging

TONE: Dramatic, engaging, exaggerated, but not cruel or offensive
STYLE: Over-the-top negative, like a comedy disaster movie

IMPORTANT: Keep it light-hearted and fun, not genuinely upsetting or harsh

"""
        
        if context:
            prompt += f"Additional context: {context}\n"
        
        prompt += "Generate only the exaggerated negative outcome text, no additional formatting or explanation."
        
        return prompt
    
    def _build_appropriateness_validation_prompt(self, outcome: str, context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for validating outcome appropriateness"""
        prompt = f"""Evaluate the following game outcome text for appropriateness and content safety.

Outcome Text: {outcome}

EVALUATION CRITERIA:
1. Age Appropriateness: Is this suitable for all ages including children?
2. Content Safety: Does it avoid violence, inappropriate themes, or offensive content?
3. Tone Appropriateness: Is the tone fun and engaging without being mean-spirited?
4. Language Appropriateness: Does it use appropriate language and avoid profanity?

EVALUATION SCALE:
- APPROPRIATE: Safe for all audiences, fun and engaging
- NEEDS_MODIFICATION: Minor issues that should be addressed
- INAPPROPRIATE: Significant issues that require major changes

"""
        
        if context:
            prompt += f"Additional context: {context}\n"
        
        prompt += """
Provide your evaluation in this exact format:
Rating: [APPROPRIATE/NEEDS_MODIFICATION/INAPPROPRIATE]
Reason: [Brief explanation of the rating]
Suggestions: [If not appropriate, suggest specific improvements]

Generate only the evaluation in the specified format."""
        
        return prompt
    
    def _build_answer_comparison_prompt(self, player_response: str, expected_answer: str) -> str:
        """Build prompt for comparing player response with expected answer"""
        return f"""Compare how similar the player's response is to the expected answer. Rate similarity on a scale of 0-100.

Expected Answer: {expected_answer}

Player Response: {player_response}

Consider:
- Core concept understanding
- Solution approach similarity  
- Key elements covered
- Overall quality and completeness

Provide only a numeric score (0-100), no explanation."""

    def _build_reasoning_analysis_prompt(self, response: str, scenario: str) -> str:
        """Build prompt for analyzing reasoning quality"""
        return f"""Analyze the reasoning quality in this response to the scenario. Rate on a scale of 0-100.

Scenario: {scenario}

Response: {response}

Evaluate:
- Logical flow and coherence
- Depth of analysis
- Clear cause-and-effect thinking
- Structured problem-solving approach

Provide only a numeric score (0-100), no explanation."""

    def _build_excellent_outcome_prompt(self, scenario: str, response: str, score: float) -> str:
        """Build prompt for excellent outcome generation"""
        return f"""Generate a dramatically POSITIVE outcome for this excellent response (score: {score:.1f}).

Scenario: {scenario}
Response: {response}

Create an over-the-top positive result that:
- Makes the player feel like a genius/hero
- Uses celebratory, triumphant language
- Includes amazing unexpected consequences
- Stays entertaining and appropriate
- Is 2-3 sentences maximum

Generate only the positive outcome, no additional text."""

    def _build_poor_outcome_prompt(self, scenario: str, response: str, score: float) -> str:
        """Build prompt for poor outcome generation"""
        return f"""Generate a dramatically NEGATIVE but entertaining outcome for this poor response (score: {score:.1f}).

Scenario: {scenario}
Response: {response}

Create an exaggerated negative result that:
- Is comically disastrous but not mean-spirited
- Uses dramatic language but stays light-hearted
- Includes funny unexpected consequences
- Remains appropriate and educational
- Is 2-3 sentences maximum

Generate only the negative outcome, no additional text."""

    def _build_average_outcome_prompt(self, scenario: str, response: str, score: float) -> str:
        """Build prompt for average outcome generation"""
        return f"""Generate a BALANCED outcome for this average response (score: {score:.1f}).

Scenario: {scenario}
Response: {response}

Create a realistic result that:
- Shows mixed results (some good, some areas for improvement)
- Uses balanced, encouraging language
- Includes both positive and constructive elements
- Stays realistic and helpful
- Is 2-3 sentences maximum

Generate only the balanced outcome, no additional text."""

    def _build_scoring_with_outcome_prompt(self, door_content: str, response: str, context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for scoring with exaggerated outcome generation"""
        return f"""Score this player response and create an exaggerated outcome based on their choice.

SCENARIO: {door_content}

PLAYER RESPONSE: {response}

TASK 1 - SCORING:
Evaluate the response on:
1. Creativity (0-100): How original and imaginative is the solution?
2. Feasibility (0-100): How realistic and practical is the approach?  
3. Originality (0-100): How unique is this solution compared to typical responses?

TASK 2 - EXAGGERATED OUTCOME:
Create a dramatic, entertaining outcome (exactly 3 sentences) that shows what happens as a result of their choice. Make it over-the-top, detailed, and fun like a comedy movie scene.

RESPOND WITH EXACTLY THESE 5 LINES (complete each line fully):
Creativity: [score 0-100]
Feasibility: [score 0-100]
Originality: [score 0-100]
Total: [average of the 3 scores above]
Outcome: [Write exactly 3 complete sentences describing the exaggerated outcome. Make it detailed and entertaining. Complete all 3 sentences fully.]

CRITICAL: The Outcome must be exactly 3 complete sentences. Do not cut off mid-sentence."""

    def _build_scoring_prompt(self, door_content: str, response: str, context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for response scoring (legacy method)"""
        prompt = f"""Score this player response to a door scenario on a scale of 0-100.

Door Scenario: {door_content}

Player Response: {response}

Evaluate the response based on:
1. Creativity (0-100): How original and imaginative is the solution?
2. Feasibility (0-100): How realistic and practical is the approach?
3. Originality (0-100): How unique is this solution compared to typical responses?

Provide scores in this exact format:
Creativity: [score]
Feasibility: [score]
Originality: [score]
Total: [average of all scores]

Only provide the scores, no additional explanation."""
        
        return prompt
    
    def _parse_scoring_result(self, result: str) -> Dict[str, float]:
        """Parse the scoring result from AI response"""
        try:
            scores = {}
            lines = result.strip().split('\n')
            
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    # Extract numeric value
                    numeric_value = ''.join(filter(str.isdigit, value))
                    if numeric_value:
                        scores[key] = float(numeric_value)
            
            # Ensure all required scores are present with defaults
            return {
                'creativity': scores.get('creativity', 50.0),
                'feasibility': scores.get('feasibility', 50.0),
                'originality': scores.get('originality', 50.0),
                'total': scores.get('total', 50.0)
            }
        
        except Exception as e:
            logger.error(f"Failed to parse scoring result: {e}")
            # Return default scores if parsing fails
            return {
                'creativity': 50.0,
                'feasibility': 50.0,
                'originality': 50.0,
                'total': 50.0
            }
    
    def _parse_scoring_with_outcome_result(self, result: str) -> Dict[str, Any]:
        """Parse scoring result with exaggerated outcome"""
        try:
            scores = {}
            outcome = ""
            lines = result.strip().split('\n')
            
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    if key == 'outcome':
                        outcome = value
                    else:
                        # Extract numeric value for scores
                        numeric_value = ''.join(filter(str.isdigit, value))
                        if numeric_value:
                            scores[key] = float(numeric_value)
            
            # Handle incomplete outcomes
            if not outcome:
                logger.warning(f"No outcome found in AI response. Raw response: {result}")
            elif len(outcome.strip()) < 50:  # Short outcome, likely cut off (expecting 3 sentences)
                logger.warning(f"Outcome appears incomplete (too short for 3 sentences): '{outcome}'")
                # Try to create a better fallback based on what we have
                if outcome.strip():
                    outcome = outcome.strip() + "... and the adventure continues with unexpected twists and amazing results!"
                else:
                    outcome = ""  # Treat as missing
            
            # Generate a better fallback based on the scenario if outcome is missing/incomplete
            fallback_outcome = "Your choice leads to unexpected adventures!"
            if not outcome:
                # Could add scenario-specific fallbacks here in the future
                pass
            
            # Ensure all required scores are present with defaults
            return {
                'creativity': scores.get('creativity', 50.0),
                'feasibility': scores.get('feasibility', 50.0),
                'originality': scores.get('originality', 50.0),
                'total': scores.get('total', 50.0),
                'exaggerated_outcome': outcome if outcome else fallback_outcome
            }
        
        except Exception as e:
            logger.error(f"Failed to parse scoring with outcome result: {e}")
            # Return default scores and outcome if parsing fails
            return {
                'creativity': 50.0,
                'feasibility': 50.0,
                'originality': 50.0,
                'total': 50.0,
                'exaggerated_outcome': "Your choice leads to unexpected adventures!"
            }
    
    def _parse_scenario_variations(self, result: str, expected_count: int) -> List[str]:
        """Parse scenario variations from AI response"""
        try:
            variations = []
            lines = result.strip().split('\n')
            
            for line in lines:
                line = line.strip()
                if line.startswith('Variation') and ':' in line:
                    # Extract the scenario text after the colon
                    _, scenario = line.split(':', 1)
                    scenario = scenario.strip()
                    if scenario:
                        variations.append(scenario)
            
            # Ensure we have the expected number of variations
            while len(variations) < expected_count:
                variations.append("A mysterious door appears before you with an unknown challenge waiting behind it.")
            
            return variations[:expected_count]
        
        except Exception as e:
            logger.error(f"Failed to parse scenario variations: {e}")
            # Return default variations if parsing fails
            return [
                "A mysterious door appears before you with an unknown challenge waiting behind it.",
                "You encounter a door that seems to pulse with strange energy.",
                "Before you stands a door that whispers secrets from the other side."
            ][:expected_count]
    
    def _parse_appropriateness_result(self, result: str) -> Dict[str, Any]:
        """Parse appropriateness validation result from AI response"""
        try:
            validation_result = {
                'rating': 'APPROPRIATE',
                'reason': 'Content appears suitable for all audiences',
                'suggestions': '',
                'is_appropriate': True
            }
            
            lines = result.strip().split('\n')
            
            for line in lines:
                line = line.strip()
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    if key == 'rating':
                        validation_result['rating'] = value.upper()
                        validation_result['is_appropriate'] = value.upper() == 'APPROPRIATE'
                    elif key == 'reason':
                        validation_result['reason'] = value
                    elif key == 'suggestions':
                        validation_result['suggestions'] = value
            
            return validation_result
        
        except Exception as e:
            logger.error(f"Failed to parse appropriateness result: {e}")
            # Return safe default if parsing fails
            return {
                'rating': 'APPROPRIATE',
                'reason': 'Default safe rating due to parsing error',
                'suggestions': '',
                'is_appropriate': True
            }
    
    def _get_fallback_outcome(self, outcome_type: str) -> str:
        """Get fallback outcome when generation fails"""
        if outcome_type == "excellent":
            return "🌟 Amazing! Your brilliant solution works perfectly and everyone is impressed by your genius!"
        elif outcome_type == "poor":
            return "😅 Oops! Your approach leads to some amusing complications, but that's how we learn!"
        else:  # average
            return "👍 Your solution works okay with mixed results - not bad, but there's room for improvement."

    def _extract_numeric_score(self, text: str) -> Optional[float]:
        """Extract numeric score from AI response"""
        try:
            import re
            # Look for numbers in the text
            numbers = re.findall(r'\d+\.?\d*', text)
            
            if numbers:
                score = float(numbers[0])
                # Ensure score is in valid range
                return min(100.0, max(0.0, score))
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting numeric score: {e}")
            return None