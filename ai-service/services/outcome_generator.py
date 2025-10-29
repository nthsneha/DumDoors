import logging
import os
from typing import Optional, Dict, Any

from services.ai_client import AIClient
from models.door import ScoreCategory

logger = logging.getLogger(__name__)

class OutcomeGenerator:
    """Generator for creating exaggerated outcomes based on response scores"""
    
    def __init__(self, ai_client: AIClient):
        self.ai_client = ai_client
        
        # Load configuration from environment
        self.exaggeration_level = os.getenv("OUTCOME_EXAGGERATION_LEVEL", "high")
        self.appropriateness_check = os.getenv("OUTCOME_APPROPRIATENESS_CHECK", "true").lower() == "true"
        
        # Score thresholds
        self.poor_threshold = float(os.getenv("SCORE_THRESHOLD_POOR_MAX", "30"))
        self.excellent_threshold = float(os.getenv("SCORE_THRESHOLD_EXCELLENT_MIN", "70"))
        
        logger.info(f"OutcomeGenerator initialized with exaggeration_level={self.exaggeration_level}, appropriateness_check={self.appropriateness_check}")
    
    async def generate_outcome_by_score(self, scenario: str, response: str, score: float) -> str:
        """Generate appropriate outcome based on score range"""
        try:
            if score <= self.poor_threshold:
                return await self.create_poor_outcome(scenario, response)
            elif score >= self.excellent_threshold:
                return await self.create_excellent_outcome(scenario, response)
            else:
                return await self.create_average_outcome(scenario, response)
                
        except Exception as e:
            logger.error(f"Error generating outcome by score: {e}")
            return self._get_fallback_outcome(score)
    
    async def create_excellent_outcome(self, scenario: str, response: str) -> str:
        """Create exaggerated positive outcome for scores 70-100"""
        try:
            prompt = self._build_excellent_outcome_prompt(scenario, response)
            
            outcome = await self.ai_client.provider.generate_text(
                prompt, 
                max_tokens=300, 
                temperature=0.8
            )
            
            # Check appropriateness if enabled
            if self.appropriateness_check:
                is_appropriate = await self._validate_appropriateness(outcome)
                if not is_appropriate:
                    logger.warning("Generated excellent outcome failed appropriateness check, using fallback")
                    return self._get_fallback_excellent_outcome()
            
            return outcome.strip()
            
        except Exception as e:
            logger.error(f"Error creating excellent outcome: {e}")
            return self._get_fallback_excellent_outcome()
    
    async def create_poor_outcome(self, scenario: str, response: str) -> str:
        """Create exaggerated negative outcome for scores 0-30"""
        try:
            prompt = self._build_poor_outcome_prompt(scenario, response)
            
            outcome = await self.ai_client.provider.generate_text(
                prompt, 
                max_tokens=300, 
                temperature=0.8
            )
            
            # Check appropriateness if enabled
            if self.appropriateness_check:
                is_appropriate = await self._validate_appropriateness(outcome)
                if not is_appropriate:
                    logger.warning("Generated poor outcome failed appropriateness check, using fallback")
                    return self._get_fallback_poor_outcome()
            
            return outcome.strip()
            
        except Exception as e:
            logger.error(f"Error creating poor outcome: {e}")
            return self._get_fallback_poor_outcome()
    
    async def create_average_outcome(self, scenario: str, response: str) -> str:
        """Create moderate outcome for scores 31-69"""
        try:
            prompt = self._build_average_outcome_prompt(scenario, response)
            
            outcome = await self.ai_client.provider.generate_text(
                prompt, 
                max_tokens=250, 
                temperature=0.7
            )
            
            # Check appropriateness if enabled
            if self.appropriateness_check:
                is_appropriate = await self._validate_appropriateness(outcome)
                if not is_appropriate:
                    logger.warning("Generated average outcome failed appropriateness check, using fallback")
                    return self._get_fallback_average_outcome()
            
            return outcome.strip()
            
        except Exception as e:
            logger.error(f"Error creating average outcome: {e}")
            return self._get_fallback_average_outcome()
    
    def _build_excellent_outcome_prompt(self, scenario: str, response: str) -> str:
        """Build prompt for excellent outcome generation"""
        exaggeration_instructions = self._get_exaggeration_instructions("positive")
        
        prompt = f"""Generate a dramatically POSITIVE and exaggerated outcome for this scenario response.

Scenario: {scenario}

Player Response: {response}

The player scored EXCELLENTLY (70-100 points) - they deserve an over-the-top positive outcome!

{exaggeration_instructions}

POSITIVE OUTCOME REQUIREMENTS:
- Make it wildly successful and triumphant
- Use dramatic, celebratory language
- Make the player feel like a genius/hero
- Include unexpected positive consequences
- Keep it entertaining and fun
- Stay appropriate for all audiences
- 2-4 sentences maximum

Generate only the exaggerated positive outcome, no additional text."""
        
        return prompt
    
    def _build_poor_outcome_prompt(self, scenario: str, response: str) -> str:
        """Build prompt for poor outcome generation"""
        exaggeration_instructions = self._get_exaggeration_instructions("negative")
        
        prompt = f"""Generate a dramatically NEGATIVE but entertaining outcome for this scenario response.

Scenario: {scenario}

Player Response: {response}

The player scored POORLY (0-30 points) - create a comically exaggerated negative outcome!

{exaggeration_instructions}

NEGATIVE OUTCOME REQUIREMENTS:
- Make it dramatically unsuccessful but funny
- Use over-the-top language but keep it light-hearted
- Make it comically disastrous, not genuinely upsetting
- Include unexpected negative consequences
- Keep it entertaining and educational
- Stay appropriate for all audiences - no mean-spirited content
- 2-4 sentences maximum

Generate only the exaggerated negative outcome, no additional text."""
        
        return prompt
    
    def _build_average_outcome_prompt(self, scenario: str, response: str) -> str:
        """Build prompt for average outcome generation"""
        prompt = f"""Generate a MODERATE outcome for this scenario response.

Scenario: {scenario}

Player Response: {response}

The player scored AVERAGELY (31-69 points) - create a balanced, realistic outcome.

MODERATE OUTCOME REQUIREMENTS:
- Make it neither great nor terrible
- Use balanced, realistic language
- Show mixed results - some good, some areas for improvement
- Include both positive and constructive elements
- Keep it encouraging but honest
- Stay appropriate for all audiences
- 2-3 sentences maximum

Generate only the moderate outcome, no additional text."""
        
        return prompt
    
    def _get_exaggeration_instructions(self, outcome_type: str) -> str:
        """Get exaggeration instructions based on level and type"""
        if self.exaggeration_level == "high":
            if outcome_type == "positive":
                return """Make it EXTREMELY over-the-top positive:
- Use superlatives and dramatic language
- Include multiple amazing consequences
- Make it feel like winning the lottery
- Use exciting punctuation and energy"""
            else:
                return """Make it EXTREMELY over-the-top negative but funny:
- Use dramatic disaster language
- Include multiple creative failures
- Make it feel like a dramatic movie disaster
- Keep it entertaining, not cruel"""
        
        elif self.exaggeration_level == "medium":
            if outcome_type == "positive":
                return """Make it moderately exaggerated positive:
- Use enthusiastic but not extreme language
- Include some great consequences
- Make it feel very successful"""
            else:
                return """Make it moderately exaggerated negative:
- Use disappointed but not extreme language
- Include some unfortunate consequences
- Make it feel unsuccessful but not devastating"""
        
        else:  # low
            if outcome_type == "positive":
                return "Make it mildly positive with some good results."
            else:
                return "Make it mildly negative with some disappointing results."
    
    async def _validate_appropriateness(self, outcome: str) -> bool:
        """Validate that outcome is appropriate for all audiences"""
        try:
            # Quick check for obviously inappropriate content
            inappropriate_words = [
                'hate', 'stupid', 'idiot', 'loser', 'failure', 'pathetic',
                'worthless', 'useless', 'terrible person', 'awful'
            ]
            
            outcome_lower = outcome.lower()
            for word in inappropriate_words:
                if word in outcome_lower:
                    logger.warning(f"Outcome contains inappropriate word: {word}")
                    return False
            
            # Use AI for more sophisticated appropriateness check if needed
            if len(outcome) > 200:  # Only for longer outcomes
                validation_result = await self.ai_client.validate_outcome_appropriateness(outcome)
                return validation_result.get("is_appropriate", True)
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating appropriateness: {e}")
            return True  # Default to appropriate if check fails
    
    def _get_fallback_outcome(self, score: float) -> str:
        """Get fallback outcome based on score"""
        if score <= self.poor_threshold:
            return self._get_fallback_poor_outcome()
        elif score >= self.excellent_threshold:
            return self._get_fallback_excellent_outcome()
        else:
            return self._get_fallback_average_outcome()
    
    def _get_fallback_excellent_outcome(self) -> str:
        """Get fallback excellent outcome"""
        outcomes = [
            "🎉 Incredible! Your brilliant solution works perfectly and everyone is amazed by your genius! You've become a legend!",
            "🌟 Outstanding! Your approach is so effective that it becomes the gold standard everyone wants to follow!",
            "🏆 Phenomenal! Your solution not only works flawlessly but also inspires others to think more creatively!",
            "✨ Spectacular! Your response demonstrates such wisdom that you're immediately recognized as an expert!"
        ]
        
        import random
        return random.choice(outcomes)
    
    def _get_fallback_poor_outcome(self) -> str:
        """Get fallback poor outcome"""
        outcomes = [
            "😅 Oops! Your approach leads to some unexpected complications, but hey, that's how we learn!",
            "🤔 Well, that didn't go quite as planned! Your solution creates a few amusing mix-ups that everyone will laugh about later.",
            "😬 Yikes! Your approach causes some comical confusion, but nothing that can't be fixed with a better plan next time!",
            "🙃 Oh dear! Your solution leads to some entertaining chaos, but it's all part of the learning adventure!"
        ]
        
        import random
        return random.choice(outcomes)
    
    def _get_fallback_average_outcome(self) -> str:
        """Get fallback average outcome"""
        outcomes = [
            "👍 Your solution works okay! It gets the job done with some mixed results - not bad, but there's room for improvement.",
            "🤷 Your approach has its ups and downs. Some parts work well while others could use some tweaking.",
            "😊 Decent effort! Your solution shows promise but could benefit from a bit more thought and refinement.",
            "👌 Your response is solid but not spectacular. It's a good foundation that could be built upon."
        ]
        
        import random
        return random.choice(outcomes)
    
    async def get_outcome_statistics(self) -> Dict[str, Any]:
        """Get statistics about outcome generation"""
        return {
            "configuration": {
                "exaggeration_level": self.exaggeration_level,
                "appropriateness_check": self.appropriateness_check,
                "poor_threshold": self.poor_threshold,
                "excellent_threshold": self.excellent_threshold
            },
            "score_ranges": {
                "poor": f"0 - {self.poor_threshold}",
                "average": f"{self.poor_threshold + 0.1:.1f} - {self.excellent_threshold - 0.1:.1f}",
                "excellent": f"{self.excellent_threshold} - 100"
            },
            "outcome_types": {
                "poor": "Exaggerated negative (but entertaining)",
                "average": "Balanced and realistic",
                "excellent": "Exaggerated positive (celebratory)"
            }
        }
    
    def update_configuration(self, exaggeration_level: Optional[str] = None, 
                           appropriateness_check: Optional[bool] = None) -> Dict[str, Any]:
        """Update outcome generator configuration"""
        try:
            old_config = {
                "exaggeration_level": self.exaggeration_level,
                "appropriateness_check": self.appropriateness_check
            }
            
            if exaggeration_level is not None:
                if exaggeration_level in ["low", "medium", "high"]:
                    self.exaggeration_level = exaggeration_level
                else:
                    raise ValueError(f"Invalid exaggeration level: {exaggeration_level}")
            
            if appropriateness_check is not None:
                self.appropriateness_check = appropriateness_check
            
            new_config = {
                "exaggeration_level": self.exaggeration_level,
                "appropriateness_check": self.appropriateness_check
            }
            
            logger.info(f"Updated outcome generator configuration: {old_config} -> {new_config}")
            
            return {
                "success": True,
                "old_configuration": old_config,
                "new_configuration": new_config
            }
            
        except Exception as e:
            logger.error(f"Error updating configuration: {e}")
            return {
                "success": False,
                "error": str(e),
                "current_configuration": {
                    "exaggeration_level": self.exaggeration_level,
                    "appropriateness_check": self.appropriateness_check
                }
            }