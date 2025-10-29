import logging
import re
from typing import List, Dict, Any, Optional

from services.ai_client import AIClient

logger = logging.getLogger(__name__)

class ReasoningAnalyzer:
    """Analyzer for evaluating reasoning quality in player responses"""
    
    def __init__(self, ai_client: AIClient):
        self.ai_client = ai_client
    
    async def evaluate_reasoning_quality(self, response: str, scenario: str) -> float:
        """Evaluate the overall reasoning quality of a response (0-100)"""
        try:
            # Use AI to evaluate reasoning quality
            ai_score = await self._ai_reasoning_evaluation(response, scenario)
            
            # Use pattern-based analysis as backup
            pattern_score = await self._pattern_based_analysis(response)
            
            # Combine scores with AI having more weight
            final_score = (ai_score * 0.8) + (pattern_score * 0.2)
            
            return min(100.0, max(0.0, final_score))
            
        except Exception as e:
            logger.error(f"Error evaluating reasoning quality: {e}")
            return 50.0  # Default score on error
    
    async def identify_reasoning_patterns(self, response: str) -> List[str]:
        """Identify reasoning patterns present in the response"""
        try:
            patterns = []
            
            # Check for different reasoning patterns
            if await self._has_causal_reasoning(response):
                patterns.append("causal_reasoning")
            
            if await self._has_logical_structure(response):
                patterns.append("logical_structure")
            
            if await self._has_evidence_based_reasoning(response):
                patterns.append("evidence_based")
            
            if await self._has_problem_solving_steps(response):
                patterns.append("step_by_step")
            
            if await self._has_consideration_of_alternatives(response):
                patterns.append("alternative_consideration")
            
            if await self._has_consequence_analysis(response):
                patterns.append("consequence_analysis")
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error identifying reasoning patterns: {e}")
            return []
    
    async def score_logical_coherence(self, response: str) -> float:
        """Score the logical coherence of the response (0-100)"""
        try:
            # Use AI to evaluate logical coherence
            ai_coherence = await self._ai_coherence_evaluation(response)
            
            # Use structural analysis
            structure_score = await self._analyze_logical_structure(response)
            
            # Combine scores
            final_score = (ai_coherence * 0.7) + (structure_score * 0.3)
            
            return min(100.0, max(0.0, final_score))
            
        except Exception as e:
            logger.error(f"Error scoring logical coherence: {e}")
            return 50.0
    
    async def _ai_reasoning_evaluation(self, response: str, scenario: str) -> float:
        """Use AI to evaluate reasoning quality"""
        try:
            prompt = f"""Evaluate the reasoning quality of this response to the given scenario.

Scenario: {scenario}

Response: {response}

Rate the reasoning quality on a scale of 0-100 based on:
1. Logical flow and coherence
2. Depth of analysis
3. Consideration of multiple factors
4. Practical thinking
5. Clear cause-and-effect relationships

Scoring guide:
- 0-20: Poor reasoning, illogical or incoherent
- 21-40: Basic reasoning with significant gaps
- 41-60: Adequate reasoning with some logical flow
- 61-80: Good reasoning with clear logic
- 81-100: Excellent reasoning, sophisticated, creative and well-structured

Provide only a numeric score (0-100), no explanation."""
            
            result = await self.ai_client.provider.generate_text(prompt, max_tokens=50, temperature=0.3)
            
            # Extract numeric score
            score = self._extract_numeric_score(result)
            return score if score is not None else 50.0
            
        except Exception as e:
            logger.error(f"AI reasoning evaluation failed: {e}")
            return 50.0
    
    async def _ai_coherence_evaluation(self, response: str) -> float:
        """Use AI to evaluate logical coherence"""
        try:
            prompt = f"""Evaluate the logical coherence of this response.

Response: {response}

Rate the logical coherence on a scale of 0-100 based on:
1. Internal consistency
2. Logical flow between ideas
3. Absence of contradictions
4. Clear connections between statements
5. Overall structural soundness

Provide only a numeric score (0-100), no explanation."""
            
            result = await self.ai_client.provider.generate_text(prompt, max_tokens=50, temperature=0.3)
            
            # Extract numeric score
            score = self._extract_numeric_score(result)
            return score if score is not None else 50.0
            
        except Exception as e:
            logger.error(f"AI coherence evaluation failed: {e}")
            return 50.0
    
    async def _pattern_based_analysis(self, response: str) -> float:
        """Analyze reasoning using pattern recognition"""
        try:
            score = 0.0
            max_score = 100.0
            
            # Check for various reasoning indicators
            patterns_found = 0
            total_patterns = 6
            
            if await self._has_causal_reasoning(response):
                patterns_found += 1
            
            if await self._has_logical_structure(response):
                patterns_found += 1
            
            if await self._has_evidence_based_reasoning(response):
                patterns_found += 1
            
            if await self._has_problem_solving_steps(response):
                patterns_found += 1
            
            if await self._has_consideration_of_alternatives(response):
                patterns_found += 1
            
            if await self._has_consequence_analysis(response):
                patterns_found += 1
            
            # Calculate score based on patterns found
            score = (patterns_found / total_patterns) * max_score
            
            return score
            
        except Exception as e:
            logger.error(f"Pattern-based analysis failed: {e}")
            return 50.0
    
    async def _analyze_logical_structure(self, response: str) -> float:
        """Analyze the logical structure of the response"""
        try:
            score = 0.0
            
            # Check for structural elements
            sentences = self._split_into_sentences(response)
            
            if len(sentences) == 0:
                return 0.0
            
            # Check for logical connectors
            connectors = [
                'because', 'therefore', 'thus', 'consequently', 'as a result',
                'however', 'although', 'despite', 'nevertheless', 'on the other hand',
                'first', 'second', 'third', 'finally', 'in conclusion',
                'if', 'then', 'when', 'since', 'given that'
            ]
            
            connector_count = 0
            for sentence in sentences:
                for connector in connectors:
                    if connector in sentence.lower():
                        connector_count += 1
                        break
            
            # Score based on presence of logical connectors
            if len(sentences) > 1:
                connector_ratio = connector_count / len(sentences)
                score += connector_ratio * 50.0
            
            # Check for question words (shows analytical thinking)
            question_words = ['why', 'how', 'what', 'when', 'where', 'who']
            question_count = 0
            
            for sentence in sentences:
                for word in question_words:
                    if word in sentence.lower():
                        question_count += 1
                        break
            
            if question_count > 0:
                score += 25.0
            
            # Check for conditional reasoning
            conditional_words = ['if', 'unless', 'provided that', 'assuming', 'suppose']
            has_conditional = any(word in response.lower() for word in conditional_words)
            
            if has_conditional:
                score += 25.0
            
            return min(100.0, score)
            
        except Exception as e:
            logger.error(f"Error analyzing logical structure: {e}")
            return 50.0
    
    async def _has_causal_reasoning(self, response: str) -> bool:
        """Check if response contains causal reasoning"""
        causal_indicators = [
            'because', 'since', 'due to', 'as a result', 'therefore', 'thus',
            'consequently', 'leads to', 'causes', 'results in', 'brings about'
        ]
        
        return any(indicator in response.lower() for indicator in causal_indicators)
    
    async def _has_logical_structure(self, response: str) -> bool:
        """Check if response has logical structure"""
        structure_indicators = [
            'first', 'second', 'third', 'finally', 'in conclusion',
            'to begin', 'next', 'then', 'lastly', 'in summary'
        ]
        
        return any(indicator in response.lower() for indicator in structure_indicators)
    
    async def _has_evidence_based_reasoning(self, response: str) -> bool:
        """Check if response uses evidence-based reasoning"""
        evidence_indicators = [
            'evidence', 'data', 'research', 'studies', 'statistics',
            'proven', 'demonstrated', 'shown', 'indicates', 'suggests'
        ]
        
        return any(indicator in response.lower() for indicator in evidence_indicators)
    
    async def _has_problem_solving_steps(self, response: str) -> bool:
        """Check if response shows step-by-step problem solving"""
        step_indicators = [
            'step', 'approach', 'method', 'process', 'procedure',
            'plan', 'strategy', 'solution', 'way to', 'how to'
        ]
        
        return any(indicator in response.lower() for indicator in step_indicators)
    
    async def _has_consideration_of_alternatives(self, response: str) -> bool:
        """Check if response considers alternatives"""
        alternative_indicators = [
            'alternatively', 'on the other hand', 'however', 'but',
            'instead', 'rather than', 'or', 'another option', 'different approach'
        ]
        
        return any(indicator in response.lower() for indicator in alternative_indicators)
    
    async def _has_consequence_analysis(self, response: str) -> bool:
        """Check if response analyzes consequences"""
        consequence_indicators = [
            'consequence', 'result', 'outcome', 'effect', 'impact',
            'implication', 'would lead to', 'might cause', 'could result'
        ]
        
        return any(indicator in response.lower() for indicator in consequence_indicators)
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        try:
            # Simple sentence splitting
            sentences = re.split(r'[.!?]+', text)
            # Filter out empty sentences and strip whitespace
            sentences = [s.strip() for s in sentences if s.strip()]
            return sentences
        except Exception as e:
            logger.error(f"Error splitting sentences: {e}")
            return []
    
    def _extract_numeric_score(self, text: str) -> Optional[float]:
        """Extract numeric score from AI response"""
        try:
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
    
    async def get_reasoning_feedback(self, response: str, patterns: List[str], score: float) -> str:
        """Generate feedback based on reasoning analysis"""
        try:
            feedback_parts = []
            
            if score >= 80:
                feedback_parts.append("Excellent reasoning demonstrated!")
            elif score >= 60:
                feedback_parts.append("Good reasoning with clear logic.")
            elif score >= 40:
                feedback_parts.append("Adequate reasoning, but could be stronger.")
            else:
                feedback_parts.append("Reasoning needs improvement.")
            
            # Add specific pattern feedback
            if "causal_reasoning" in patterns:
                feedback_parts.append("Shows good cause-and-effect thinking.")
            
            if "logical_structure" in patterns:
                feedback_parts.append("Well-structured logical flow.")
            
            if "evidence_based" in patterns:
                feedback_parts.append("Uses evidence-based reasoning.")
            
            if "step_by_step" in patterns:
                feedback_parts.append("Demonstrates systematic problem-solving.")
            
            if "alternative_consideration" in patterns:
                feedback_parts.append("Considers multiple perspectives.")
            
            if "consequence_analysis" in patterns:
                feedback_parts.append("Analyzes potential consequences well.")
            
            # Suggest improvements if score is low
            if score < 60:
                if "causal_reasoning" not in patterns:
                    feedback_parts.append("Try explaining why things happen.")
                
                if "logical_structure" not in patterns:
                    feedback_parts.append("Consider organizing your thoughts step by step.")
            
            return " ".join(feedback_parts)
            
        except Exception as e:
            logger.error(f"Error generating reasoning feedback: {e}")
            return "Unable to generate detailed feedback at this time."