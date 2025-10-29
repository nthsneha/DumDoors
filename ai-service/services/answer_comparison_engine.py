import logging
import re
from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher

from services.ai_client import AIClient

logger = logging.getLogger(__name__)

class AnswerComparisonEngine:
    """Engine for comparing player responses against expected answers"""
    
    def __init__(self, ai_client: AIClient):
        self.ai_client = ai_client
    
    async def compare_responses(self, player_response: str, expected_answer: str) -> float:
        """Compare player response against expected answer and return similarity score (0-100)"""
        try:
            # Use AI to perform intelligent comparison
            ai_score = await self._ai_comparison(player_response, expected_answer)
            
            # Use text similarity as a backup/validation
            text_score = await self._text_similarity_comparison(player_response, expected_answer)
            
            # Combine scores with AI having more weight
            final_score = (ai_score * 0.7) + (text_score * 0.3)
            
            return min(100.0, max(0.0, final_score))
            
        except Exception as e:
            logger.error(f"Error comparing responses: {e}")
            # Fallback to text similarity only
            return await self._text_similarity_comparison(player_response, expected_answer)
    
    async def analyze_solution_approach(self, player_response: str, expected_reasoning: List[str]) -> float:
        """Analyze how well the player's solution approach matches expected reasoning points"""
        try:
            if not expected_reasoning:
                logger.warning("No expected reasoning provided for analysis")
                return 50.0  # Default score
            
            # Use AI to analyze reasoning alignment
            reasoning_score = await self._ai_reasoning_analysis(player_response, expected_reasoning)
            
            # Check for key reasoning elements
            element_score = await self._check_reasoning_elements(player_response, expected_reasoning)
            
            # Combine scores
            final_score = (reasoning_score * 0.6) + (element_score * 0.4)
            
            return min(100.0, max(0.0, final_score))
            
        except Exception as e:
            logger.error(f"Error analyzing solution approach: {e}")
            return 50.0  # Default score on error
    
    async def calculate_similarity_score(self, response1: str, response2: str) -> float:
        """Calculate similarity score between two responses"""
        try:
            # Normalize responses
            norm_response1 = self._normalize_text(response1)
            norm_response2 = self._normalize_text(response2)
            
            # Use SequenceMatcher for basic similarity
            similarity = SequenceMatcher(None, norm_response1, norm_response2).ratio()
            
            # Convert to 0-100 scale
            return similarity * 100.0
            
        except Exception as e:
            logger.error(f"Error calculating similarity score: {e}")
            return 0.0
    
    async def _ai_comparison(self, player_response: str, expected_answer: str) -> float:
        """Use AI to compare player response with expected answer"""
        try:
            prompt = f"""Compare the following player response with the expected answer and rate how similar they are in terms of meaning, approach, and quality.

Expected Answer: {expected_answer}

Player Response: {player_response}

Rate the similarity on a scale of 0-100 where:
- 0-20: Completely different or wrong approach
- 21-40: Some relevant elements but major differences
- 41-60: Partially correct with some good points
- 61-80: Good answer with minor differences
- 81-100: Excellent answer, very similar or better than expected

Consider:
1. Core concept understanding
2. Solution approach similarity
3. Practical feasibility
4. Overall quality

Provide only a numeric score (0-100), no explanation."""
            
            result = await self.ai_client.provider.generate_text(prompt, max_tokens=50, temperature=0.3)
            
            # Extract numeric score
            score = self._extract_numeric_score(result)
            return score if score is not None else 50.0
            
        except Exception as e:
            logger.error(f"AI comparison failed: {e}")
            return 50.0
    
    async def _ai_reasoning_analysis(self, player_response: str, expected_reasoning: List[str]) -> float:
        """Use AI to analyze reasoning quality"""
        try:
            reasoning_text = "\n".join([f"- {point}" for point in expected_reasoning])
            
            prompt = f"""Analyze how well the player's response demonstrates the expected reasoning patterns.

Expected Reasoning Points:
{reasoning_text}

Player Response: {player_response}

Rate how well the player's response shows these reasoning patterns on a scale of 0-100:
- 0-20: No evidence of expected reasoning
- 21-40: Minimal reasoning alignment
- 41-60: Some reasoning elements present
- 61-80: Good reasoning with most elements
- 81-100: Excellent reasoning, all elements well demonstrated

Provide only a numeric score (0-100), no explanation."""
            
            result = await self.ai_client.provider.generate_text(prompt, max_tokens=50, temperature=0.3)
            
            # Extract numeric score
            score = self._extract_numeric_score(result)
            return score if score is not None else 50.0
            
        except Exception as e:
            logger.error(f"AI reasoning analysis failed: {e}")
            return 50.0
    
    async def _text_similarity_comparison(self, player_response: str, expected_answer: str) -> float:
        """Compare responses using text similarity algorithms"""
        try:
            # Normalize both texts
            norm_player = self._normalize_text(player_response)
            norm_expected = self._normalize_text(expected_answer)
            
            # Calculate different similarity metrics
            sequence_similarity = SequenceMatcher(None, norm_player, norm_expected).ratio()
            
            # Word overlap similarity
            player_words = set(norm_player.split())
            expected_words = set(norm_expected.split())
            
            if not expected_words:
                word_similarity = 0.0
            else:
                common_words = player_words.intersection(expected_words)
                word_similarity = len(common_words) / len(expected_words)
            
            # Key phrase similarity
            phrase_similarity = await self._calculate_phrase_similarity(norm_player, norm_expected)
            
            # Combine similarities
            combined_score = (
                sequence_similarity * 0.3 +
                word_similarity * 0.4 +
                phrase_similarity * 0.3
            ) * 100.0
            
            return min(100.0, max(0.0, combined_score))
            
        except Exception as e:
            logger.error(f"Text similarity comparison failed: {e}")
            return 0.0
    
    async def _check_reasoning_elements(self, player_response: str, expected_reasoning: List[str]) -> float:
        """Check for presence of key reasoning elements in player response"""
        try:
            if not expected_reasoning:
                return 50.0
            
            norm_response = self._normalize_text(player_response)
            elements_found = 0
            
            for reasoning_point in expected_reasoning:
                # Extract key concepts from reasoning point
                key_concepts = self._extract_key_concepts(reasoning_point)
                
                # Check if any key concepts are present in player response
                for concept in key_concepts:
                    if concept.lower() in norm_response.lower():
                        elements_found += 1
                        break  # Count each reasoning point only once
            
            # Calculate percentage of reasoning elements found
            if expected_reasoning:
                score = (elements_found / len(expected_reasoning)) * 100.0
            else:
                score = 50.0
            
            return min(100.0, max(0.0, score))
            
        except Exception as e:
            logger.error(f"Error checking reasoning elements: {e}")
            return 50.0
    
    async def _calculate_phrase_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity based on common phrases"""
        try:
            # Extract phrases (2-3 word combinations)
            phrases1 = self._extract_phrases(text1)
            phrases2 = self._extract_phrases(text2)
            
            if not phrases2:
                return 0.0
            
            # Find common phrases
            common_phrases = phrases1.intersection(phrases2)
            
            # Calculate similarity ratio
            similarity = len(common_phrases) / len(phrases2) if phrases2 else 0.0
            
            return similarity
            
        except Exception as e:
            logger.error(f"Error calculating phrase similarity: {e}")
            return 0.0
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison"""
        try:
            # Convert to lowercase
            text = text.lower()
            
            # Remove extra whitespace
            text = re.sub(r'\s+', ' ', text)
            
            # Remove punctuation except apostrophes
            text = re.sub(r'[^\w\s\']', ' ', text)
            
            # Remove extra spaces
            text = text.strip()
            
            return text
            
        except Exception as e:
            logger.error(f"Error normalizing text: {e}")
            return text
    
    def _extract_key_concepts(self, text: str) -> List[str]:
        """Extract key concepts from text"""
        try:
            # Normalize text
            norm_text = self._normalize_text(text)
            
            # Split into words and filter out common words
            words = norm_text.split()
            
            # Common words to filter out
            stop_words = {
                'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
                'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
                'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
                'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
            }
            
            # Filter out stop words and short words
            key_concepts = [word for word in words if len(word) > 2 and word not in stop_words]
            
            return key_concepts
            
        except Exception as e:
            logger.error(f"Error extracting key concepts: {e}")
            return []
    
    def _extract_phrases(self, text: str) -> set:
        """Extract 2-3 word phrases from text"""
        try:
            words = text.split()
            phrases = set()
            
            # Extract 2-word phrases
            for i in range(len(words) - 1):
                phrase = f"{words[i]} {words[i+1]}"
                phrases.add(phrase)
            
            # Extract 3-word phrases
            for i in range(len(words) - 2):
                phrase = f"{words[i]} {words[i+1]} {words[i+2]}"
                phrases.add(phrase)
            
            return phrases
            
        except Exception as e:
            logger.error(f"Error extracting phrases: {e}")
            return set()
    
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