import os
import asyncio
import logging
from typing import Dict, Any, Optional, List
from abc import ABC, abstractmethod
import httpx
import openai
from anthropic import Anthropic

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

class OpenAIProvider(BaseAIProvider):
    """OpenAI provider implementation"""
    
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo"):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model
    
    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        try:
            # Simple test request
            await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "test"}],
                max_tokens=1
            )
            return {"status": "healthy", "provider": "openai", "model": self.model}
        except Exception as e:
            return {"status": "unhealthy", "provider": "openai", "error": str(e)}

class AnthropicProvider(BaseAIProvider):
    """Anthropic provider implementation"""
    
    def __init__(self, api_key: str, model: str = "claude-3-sonnet-20240229"):
        self.client = Anthropic(api_key=api_key)
        self.model = model
    
    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        try:
            # Anthropic doesn't have async client, so we'll use asyncio.to_thread
            response = await asyncio.to_thread(
                self.client.messages.create,
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Anthropic generation failed: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        try:
            # Simple test request
            await asyncio.to_thread(
                self.client.messages.create,
                model=self.model,
                max_tokens=1,
                messages=[{"role": "user", "content": "test"}]
            )
            return {"status": "healthy", "provider": "anthropic", "model": self.model}
        except Exception as e:
            return {"status": "unhealthy", "provider": "anthropic", "error": str(e)}

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
        provider_type = os.getenv("AI_PROVIDER", "mock").lower()
        
        if provider_type == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OpenAI API key not found, falling back to mock provider")
                return MockAIProvider()
            model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
            return OpenAIProvider(api_key, model)
        
        elif provider_type == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                logger.warning("Anthropic API key not found, falling back to mock provider")
                return MockAIProvider()
            model = os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet-20240229")
            return AnthropicProvider(api_key, model)
        
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
    
    async def score_response(self, door_content: str, response: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
        """Score a player response using the AI provider"""
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
    
    def _build_scoring_prompt(self, door_content: str, response: str, context: Optional[Dict[str, Any]]) -> str:
        """Build a prompt for response scoring"""
        prompt = f"""Score this player response to a door scenario on a scale of 0-100.

Door Scenario: {door_content}

Player Response: {response}

Evaluate the response based on:
1. Creativity (0-100): How original and imaginative is the solution?
2. Feasibility (0-100): How realistic and practical is the approach?
3. Humor (0-100): How entertaining or clever is the response?
4. Originality (0-100): How unique is this solution compared to typical responses?

Provide scores in this exact format:
Creativity: [score]
Feasibility: [score]
Humor: [score]
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
                'humor': scores.get('humor', 50.0),
                'originality': scores.get('originality', 50.0),
                'total': scores.get('total', 50.0)
            }
        
        except Exception as e:
            logger.error(f"Failed to parse scoring result: {e}")
            # Return default scores if parsing fails
            return {
                'creativity': 50.0,
                'feasibility': 50.0,
                'humor': 50.0,
                'originality': 50.0,
                'total': 50.0
            }