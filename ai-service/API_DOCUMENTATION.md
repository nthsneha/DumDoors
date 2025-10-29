# DumDoors AI Scoring Service API

## Overview

The AI Scoring Service is responsible for **evaluating and scoring player responses** to door scenarios. Door generation is handled by the backend - this service focuses solely on scoring and evaluation.

## Architecture Flow

```
Backend → Generates Door → Sends (Door + Response) → AI Service → Returns (Score + Feedback) → Backend
```

1. **Backend**: Generates door scenarios
2. **AI Service**: Receives door content + player response, returns scoring and feedback
3. **Backend**: Uses scoring to determine next door and game progression

## Core Endpoints

### 🎯 Scoring Endpoints

#### `POST /scoring/score-response`
Score a player's response to a door scenario.

**Request:**
```json
{
  "door_content": "You're in a meeting where your boss asks for volunteers...",
  "response": "I would volunteer and ask for clarification on scope...",
  "context": "Optional context information"
}
```

**Response:**
```json
{
  "response_id": "uuid",
  "total_score": 75.5,
  "metrics": {
    "creativity": 70.0,
    "feasibility": 85.0,
    "originality": 71.5
  },
  "feedback": "Great practical approach with good strategic thinking...",
  "path_recommendation": "challenging_path",
  "processing_time_ms": 1250.5
}
```

#### `POST /evaluation/evaluate-response`
Enhanced evaluation with outcomes and detailed path recommendations.

**Request:**
```json
{
  "scenario_id": "scenario_001",
  "player_response": "I would carefully analyze the situation...",
  "session_id": "session_123",
  "context": "Enhanced evaluation context"
}
```

**Response:**
```json
{
  "score": 78.5,
  "best_outcome": "Your strategic approach leads to amazing success...",
  "worst_outcome": "Your overthinking causes missed opportunities...",
  "path_recommendation": "strategic_path",
  "reasoning": "Response shows good analytical thinking...",
  "processing_time_ms": 1850.2
}
```

#### `POST /scoring/batch-score`
Score multiple responses in a single request.

**Request:**
```json
[
  {
    "door_content": "Scenario 1...",
    "response": "Response 1...",
    "context": "Batch item 1"
  },
  {
    "door_content": "Scenario 2...",
    "response": "Response 2...",
    "context": "Batch item 2"
  }
]
```

### 📊 Monitoring Endpoints

#### `GET /health`
Service health check.

#### `GET /service/status`
Comprehensive service status including initialization state.

#### `GET /config/summary`
Current service configuration summary.

#### `GET /scenarios/stats`
Scenario repository statistics.

### 🔧 Management Endpoints

#### `POST /scenarios/reload`
Reload scenarios from file.

#### `GET /scenarios/validate`
Validate scenario integrity.

#### `POST /config/reload`
Reload and validate service configuration.

## Evaluation Criteria

The AI service evaluates responses based on three core criteria:

### 1. **Feasibility** (0-100)
- How realistic and practical is the approach?
- Can this solution actually be implemented?
- Does it consider real-world constraints?

### 2. **Creativity** (0-100)
- How original and imaginative is the solution?
- Does it show innovative thinking?
- Is it a fresh approach to the problem?

### 3. **Originality** (0-100)
- How unique is this solution compared to typical responses?
- Does it stand out from common approaches?
- Is it a novel way of thinking about the problem?

**Note:** Humor has been removed as an evaluation criterion.

## Response Types

### Path Recommendations
Based on scoring, the service recommends different paths:
- `easy_path`: For lower scores, gentler progression
- `normal_path`: Standard progression
- `challenging_path`: For higher scores, more difficult scenarios
- `strategic_path`: For analytical responses
- `creative_path`: For highly creative responses

### Outcome Generation
The service generates exaggerated positive and negative outcomes:
- **Best Outcome**: Over-the-top positive result
- **Worst Outcome**: Dramatically negative (but entertaining) result

## Configuration

Key environment variables:
- `GEMINI_API_KEY`: Required for AI functionality
- `AI_PROVIDER`: AI service provider (default: "gemini")
- `SCORE_THRESHOLD_POOR_MAX`: Threshold for poor performance (default: 30)
- `SCORE_THRESHOLD_EXCELLENT_MIN`: Threshold for excellent performance (default: 70)

## Error Handling

The service includes comprehensive error handling:
- Invalid requests return appropriate HTTP status codes
- AI service failures fall back to default scoring
- Configuration issues are logged and handled gracefully
- Timeout protection for AI requests

## Testing

Run the test suite to validate functionality:
```bash
# Run all tests
python3 run_tests.py

# Test evaluation criteria specifically
python3 test_evaluation_criteria.py

# Run comprehensive service tests
python3 test_ai_service_comprehensive.py
```

## Integration Notes

### For Backend Integration:
1. Generate door scenarios in your backend
2. Send door content + player response to AI service
3. Receive scoring and feedback
4. Use scoring to determine next door and game progression
5. Display feedback and outcomes to player

### Sample Integration Flow:
```python
# Backend generates door
door = generate_door_scenario(theme="workplace", difficulty="medium")

# Player submits response
player_response = "I would approach my colleague privately..."

# Send to AI service for scoring
scoring_request = {
    "door_content": door.content,
    "response": player_response,
    "context": f"Player: {player_id}, Session: {session_id}"
}

ai_response = await post("/scoring/score-response", scoring_request)

# Use scoring for game progression
next_door = determine_next_door(ai_response.total_score, ai_response.path_recommendation)
```