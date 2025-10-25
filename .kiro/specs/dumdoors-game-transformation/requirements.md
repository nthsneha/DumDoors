# DumDoors Game Requirements Document

## Introduction

DumDoors is a multiplayer AI decision game built on Reddit's Devvit platform. Players are presented with funny, clever, or tricky "situations" (called doors) and must describe how they would solve them. An AI system scores their responses, and based on these scores, the player's path dynamically changes - good choices lead to fewer doors while poor choices result in more doors. The game supports both multiplayer (race to the end) and single-player (themed) modes.

## Glossary

- **DumDoors_System**: The complete game application running on Reddit's Devvit platform
- **Door**: A situation or scenario presented to players that requires a creative solution
- **Player_Response**: A text-based solution submitted by a player for a given door
- **AI_Scoring_Service**: External AI microservice that evaluates player responses and assigns scores
- **Game_Session**: An active game instance with one or more players
- **Player_Path**: The dynamic route through doors based on player performance
- **Multiplayer_Mode**: Game mode where multiple players race to complete their paths first
- **Single_Player_Mode**: Game mode with themed scenarios for individual play
- **Game_Backend**: Go-based microservice handling game logic, WebSocket connections, and data persistence
- **Graph_Database**: Neo4j database storing door relationships and player paths
- **Document_Database**: MongoDB database for user data, scores, and game history

## Requirements

### Requirement 1

**User Story:** As a Reddit user, I want to start a new DumDoors game session, so that I can play the AI decision game with other players or solo.

#### Acceptance Criteria

1. WHEN a Reddit user accesses the DumDoors post, THE DumDoors_System SHALL display a game lobby interface
2. WHERE multiplayer mode is selected, THE DumDoors_System SHALL allow up to 8 players to join the same Game_Session
3. WHERE single-player mode is selected, THE DumDoors_System SHALL immediately start a themed game for the individual player
4. THE DumDoors_System SHALL authenticate players using Reddit's user authentication system
5. WHEN a Game_Session reaches the minimum player count, THE DumDoors_System SHALL provide a start game option to the session creator

### Requirement 2

**User Story:** As a player, I want to receive creative and engaging door scenarios, so that I can provide interesting solutions and enjoy the gameplay experience.

#### Acceptance Criteria

1. WHEN a Game_Session begins, THE DumDoors_System SHALL present the first Door to all players simultaneously
2. THE DumDoors_System SHALL retrieve Door content from the AI_Scoring_Service
3. WHILE a Door is active, THE DumDoors_System SHALL display a text input interface for Player_Response submission
4. THE DumDoors_System SHALL enforce a maximum response length of 500 characters per Player_Response
5. WHEN a player submits a Player_Response, THE DumDoors_System SHALL disable further input until all players respond or timeout occurs

### Requirement 3

**User Story:** As a player, I want my creative solutions to be fairly evaluated by AI, so that my game progression accurately reflects my problem-solving abilities.

#### Acceptance Criteria

1. WHEN all players submit responses or timeout occurs, THE DumDoors_System SHALL send all Player_Response data to the AI_Scoring_Service
2. THE AI_Scoring_Service SHALL return numerical scores between 0 and 100 for each Player_Response
3. THE DumDoors_System SHALL calculate the next Door for each player based on their AI score
4. WHERE a player scores above 70, THE DumDoors_System SHALL advance them on a shorter path with fewer doors
5. WHERE a player scores below 30, THE DumDoors_System SHALL route them to a longer path with additional doors

### Requirement 4

**User Story:** As a player, I want to see my progress and compete with others, so that I can track my performance and enjoy the competitive aspect.

#### Acceptance Criteria

1. WHILE a Game_Session is active, THE DumDoors_System SHALL display each player's current position and remaining doors
2. THE DumDoors_System SHALL show real-time score updates after each Door completion
3. WHEN a player completes their final Door, THE DumDoors_System SHALL declare them the winner in multiplayer mode
4. THE DumDoors_System SHALL maintain a leaderboard of fastest completion times and highest average scores
5. WHEN a Game_Session ends, THE DumDoors_System SHALL display final rankings and individual performance statistics

### Requirement 5

**User Story:** As a player, I want the game to run smoothly with real-time updates, so that I can have an engaging multiplayer experience without technical issues.

#### Acceptance Criteria

1. THE DumDoors_System SHALL establish WebSocket connections for real-time communication between players
2. WHEN any player submits a Player_Response, THE DumDoors_System SHALL broadcast the submission status to all players in the Game_Session
3. THE DumDoors_System SHALL implement a 60-second timeout for each Door response phase
4. IF a player disconnects during gameplay, THE DumDoors_System SHALL allow reconnection and state restoration for up to 5 minutes
5. THE DumDoors_System SHALL handle up to 50 concurrent Game_Sessions without performance degradation

### Requirement 6

**User Story:** As a game administrator, I want the system to be scalable and maintainable, so that it can handle growth and be easily updated with new features.

#### Acceptance Criteria

1. THE DumDoors_System SHALL store all game data in the Document_Database for persistence and analytics
2. THE DumDoors_System SHALL cache frequently accessed Door content using Redis for improved performance
3. THE Graph_Database SHALL maintain the complex relationships between doors and player paths
4. THE DumDoors_System SHALL log all player actions and system events for debugging and analytics
5. THE Game_Backend SHALL expose REST APIs for administrative functions and game statistics