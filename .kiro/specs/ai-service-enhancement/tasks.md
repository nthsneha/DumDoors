# Implementation Plan

- [x] 1. Create data models for curated scenarios and enhanced evaluation
  - Create CuratedScenario model with expected answers and reasoning criteria
  - Create ExpectedAnswer model for structured answer comparison
  - Create ResponseEvaluationRequest and EvaluationWithOutcomeResponse models
  - Enhance existing ScoringResult model with new evaluation fields
  - _Requirements: 1.1, 1.3, 2.1_

- [ ] 2. Implement curated scenario management system
- [x] 2.1 Create ScenarioRepository class
  - Implement JSONL file loading for curated scenarios
  - Add scenario retrieval methods by ID, theme, and random selection
  - Create in-memory caching for fast scenario access
  - _Requirements: 4.1, 4.2_

- [x] 2.2 Implement ExpectedAnswerManager
  - Create methods to retrieve expected answers and reasoning criteria
  - Add answer format validation functionality
  - Implement scoring weight management for different answer types
  - _Requirements: 1.1, 1.2_

- [x] 2.3 Create ScenarioLoader for initialization
  - Implement scenario database initialization from JSONL files
  - Add scenario integrity validation and error handling
  - Create reload functionality for updating scenarios without restart
  - _Requirements: 4.1, 4.2_

- [ ] 3. Replace scenario generation with curated scenario retrieval
- [x] 3.1 Modify DoorService to use curated scenarios
  - Replace AI generation with scenario repository lookup
  - Update door creation to use curated scenario data
  - Remove caching logic since scenarios are pre-loaded
  - _Requirements: 4.1, 4.2_

- [x] 3.2 Create curated scenario retrieval endpoint
  - Implement /scenarios/get-scenario API endpoint
  - Add theme-based filtering and random selection
  - Remove old generation endpoints that are no longer needed
  - _Requirements: 4.2_

- [ ] 4. Implement enhanced response evaluation engine
- [x] 4.1 Create AnswerComparisonEngine class
  - Implement response comparison against expected answers
  - Add solution approach analysis using AI prompting
  - Create similarity scoring algorithms for text comparison
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4.2 Implement ReasoningAnalyzer
  - Create reasoning quality evaluation methods
  - Add logical coherence scoring functionality
  - Implement reasoning pattern identification
  - _Requirements: 1.2, 1.4_

- [x] 4.3 Create ScoringCalculator for comprehensive scoring
  - Implement total score calculation from comparison and reasoning scores
  - Add score categorization logic (poor: 0-30, average: 31-69, excellent: 70-100)
  - Create detailed feedback generation based on scoring breakdown
  - _Requirements: 1.3, 1.5_

- [ ] 5. Implement outcome generation system with path recommendations
- [x] 5.1 Create OutcomeGenerator with score-based outcomes
  - Implement excellent outcome generation for scores 70-100
  - Create poor outcome generation for scores 0-30
  - Add average outcome generation for scores 31-69
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5.2 Implement PathRecommendationEngine
  - Create path difficulty determination based on score ranges
  - Add node count calculation using environment configuration
  - Implement path configuration management (min/max nodes from env)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6. Enhance ScoringService with new evaluation capabilities
- [x] 6.1 Modify ScoringService to integrate new evaluation components
  - Update score_response method to use AnswerComparisonEngine and ReasoningAnalyzer
  - Add outcome generation integration with score-based logic
  - Integrate path recommendation functionality
  - _Requirements: 1.1, 1.2, 2.1, 3.1_

- [x] 6.2 Create enhanced evaluation endpoint
  - Implement /evaluation/evaluate-response API endpoint
  - Add comprehensive response evaluation with outcomes and path recommendations
  - Update response format to include all new evaluation data
  - _Requirements: 1.5, 2.4, 3.5_

- [ ] 7. Update AI client for enhanced evaluation prompting
- [x] 7.1 Enhance AIClient for answer comparison prompts
  - Create prompt templates for comparing player responses to expected answers
  - Add reasoning analysis prompts for evaluating logical coherence
  - Update scoring prompts to focus on answer similarity rather than creativity metrics
  - _Requirements: 1.1, 1.2_

- [x] 7.2 Add outcome generation prompts to AIClient
  - Create prompt templates for excellent outcomes (scores 70-100)
  - Implement prompt templates for poor outcomes (scores 0-30)
  - Add prompt templates for average outcomes (scores 31-69)
  - Ensure all outcome prompts maintain appropriateness validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 8. Implement environment configuration management
- [x] 8.1 Add configuration for scoring thresholds and path parameters
  - Implement environment variable loading for score thresholds
  - Add path node configuration (min/max nodes) from environment
  - Create scoring weight configuration for comparison vs reasoning
  - _Requirements: 3.4, 5.1, 5.5_

- [x] 8.2 Update service initialization with new configuration
  - Modify service startup to load curated scenarios
  - Add configuration validation and error handling
  - Implement graceful fallback for missing configuration
  - _Requirements: 4.1, 5.1, 5.5_

- [ ] 9. Implement comprehensive error handling and monitoring
- [ ] 9.1 Add error handling for scenario loading and evaluation
  - Implement fallback mechanisms for scenario loading failures
  - Add graceful degradation when evaluation components fail
  - Create detailed error logging for debugging
  - _Requirements: 4.3, 4.5_

- [ ] 9.2 Create performance monitoring for evaluation system
  - Implement metrics tracking for evaluation response times
  - Add monitoring for scoring accuracy and consistency
  - Create API endpoints for service performance statistics
  - _Requirements: 4.5, 5.2, 5.3_

- [ ] 10. Update API documentation and remove unused endpoints
  - Update FastAPI documentation for new evaluation endpoints
  - Remove documentation for old scenario generation endpoints
  - Add example requests and responses for curated scenario system
  - Document new environment configuration options
  - _Requirements: 4.4, 5.4_

- [ ]* 11. Create comprehensive test suite for evaluation system
- [ ]* 11.1 Write unit tests for curated scenario management
  - Test ScenarioRepository loading and retrieval functionality
  - Test ExpectedAnswerManager answer comparison logic
  - Test ScenarioLoader initialization and validation
  - _Requirements: 4.1, 4.2_

- [ ]* 11.2 Write unit tests for evaluation engine components
  - Test AnswerComparisonEngine response comparison algorithms
  - Test ReasoningAnalyzer logical coherence scoring
  - Test ScoringCalculator score calculation and categorization
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 11.3 Write unit tests for outcome generation and path recommendation
  - Test OutcomeGenerator score-based outcome creation
  - Test PathRecommendationEngine path difficulty determination
  - Test environment configuration loading and validation
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [ ]* 11.4 Write integration tests for complete evaluation flow
  - Test end-to-end response evaluation with curated scenarios
  - Test API endpoints with realistic request/response scenarios
  - Test error handling and fallback mechanisms
  - _Requirements: 1.5, 4.3, 4.5_