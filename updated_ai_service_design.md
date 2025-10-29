# Updated AI Service Design

## Enhanced Python AI Service

The AI service has been redesigned to focus on two core objectives:

### 1. Dynamic Scenario Generation
- **Unique Every Time**: Uses template-based generation with randomized content pools
- **No Repetition**: Maintains cache of recent scenarios to ensure uniqueness
- **Thematic Flexibility**: Supports different themes and difficulty levels
- **Realistic Scenarios**: All generated scenarios are grounded in real-life situations

### 2. Intelligent Response Evaluation
- **Multi-Dimensional Scoring**: Evaluates creativity, feasibility, humor, and originality
- **Exaggerated Outcomes**: Provides entertaining best/worst case scenarios based on response quality
- **Detailed Reasoning**: Explains why a response received its score
- **Score Range**: 0-100 scale reflecting decision quality

## API Interface

```python
class AIService:
    async def generate_door(self, theme: str = "general", difficulty: int = 5, exclude_recent: List[str] = []) -> Door:
        """
        Generate a new, unique scenario every time
        - Uses dynamic template system with content pools
        - Ensures no repetition with recent scenario cache
        - Returns Door object with scenario content and metadata
        """
    
    async def score_response(self, door_content: str, user_response: str) -> ScoringResult:
        """
        Evaluate user response and provide comprehensive scoring
        - Analyzes creativity, feasibility, humor, originality
        - Generates exaggerated best/worst outcomes
        - Provides detailed reasoning for the score
        - Returns score 0-100 reflecting decision quality
        """
```

## Data Models

```python
class Door(BaseModel):
    id: str                           # Unique identifier
    content: str                      # The scenario text
    theme: str                        # Theme category
    difficulty: int                   # Difficulty level 1-10
    expected_solution_types: List[str] # Types of solutions that work well
    created_at: datetime              # Generation timestamp

class ScoringResult(BaseModel):
    score: int                        # Overall score 0-100
    creativity: int                   # Creativity subscore 0-100
    feasibility: int                  # Feasibility subscore 0-100
    humor: int                        # Humor subscore 0-100
    originality: int                  # Originality subscore 0-100
    best_outcome: str                 # Exaggerated positive outcome
    worst_outcome: str                # Exaggerated negative outcome
    reasoning: str                    # Explanation of the scoring
```

## Scenario Generation System

### Template-Based Generation
- **10+ Scenario Templates**: Different patterns for various situation types
- **Dynamic Content Pools**: 15+ categories with multiple options each
- **Randomized Assembly**: Each generation creates unique combinations
- **Quality Filtering**: Ensures scenarios meet minimum quality standards

### Content Categories
- Locations, events, constraints, technology malfunctions
- Social situations, embarrassing actions, timing issues
- Communication errors, confined spaces, body functions
- Personal items, audiences, critical moments

### Uniqueness Guarantee
- **Recent Cache**: Tracks last 50 scenarios to prevent repetition
- **Hash-Based IDs**: Unique identifiers for each scenario
- **Exclusion Lists**: Can exclude specific scenarios from generation
- **Fallback System**: Ensures service never fails to generate

## Response Evaluation System

### Multi-Dimensional Analysis
1. **Creativity (30% weight)**: Unique approaches, innovative thinking
2. **Feasibility (30% weight)**: Realistic, practical solutions
3. **Humor (20% weight)**: Entertainment value, wit, cleverness
4. **Originality (20% weight)**: Avoiding common/cliche responses

### Scoring Algorithm
- **Base Scores**: Everyone gets minimum points for participation
- **Bonus Systems**: Rewards for quality indicators in each dimension
- **Penalty Systems**: Deductions for unrealistic or harmful suggestions
- **Length Bonuses**: Rewards for detailed, thoughtful responses

### Exaggerated Outcomes
- **Score-Based**: Different outcome templates based on score ranges
- **Contextual**: Incorporates elements from the original scenario
- **Entertaining**: Designed to be funny while being instructive
- **Motivational**: Encourages better decision-making

## Integration with Game Backend

### API Endpoints
- `POST /generate-scenario`: Generate new unique scenario
- `POST /evaluate-response`: Score user response with outcomes
- `GET /health`: Service health check

### Error Handling
- **Graceful Degradation**: Fallback scenarios if generation fails
- **Timeout Protection**: Prevents hanging requests
- **Input Validation**: Sanitizes and validates all inputs
- **Comprehensive Logging**: Tracks all operations for debugging

### Performance Considerations
- **Fast Generation**: Template system enables sub-second scenario creation
- **Efficient Scoring**: Lightweight algorithms for real-time evaluation
- **Memory Management**: Limited cache sizes prevent memory bloat
- **Concurrent Handling**: Async design supports multiple simultaneous requests

## Deployment Configuration

### Docker Container
- **Python 3.11**: Modern Python runtime
- **FastAPI**: High-performance async web framework
- **Health Checks**: Built-in monitoring endpoints
- **Non-root User**: Security best practices

### Resource Requirements
- **CPU**: Minimal, mostly text processing
- **Memory**: ~100MB base + cache storage
- **Network**: HTTP API, no persistent connections
- **Storage**: Stateless, no persistent data

This enhanced AI service provides the core intelligence for the DumDoors game, ensuring every player gets unique scenarios and meaningful feedback on their decision-making skills.