// Neo4j initialization script for DumDoors game path relationships

// Create constraints for unique identifiers
CREATE CONSTRAINT door_id_unique IF NOT EXISTS FOR (d:Door) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT player_id_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT path_id_unique IF NOT EXISTS FOR (path:Path) REQUIRE path.id IS UNIQUE;

// Create indexes for performance
CREATE INDEX door_theme_difficulty IF NOT EXISTS FOR (d:Door) ON (d.theme, d.difficulty);
CREATE INDEX player_current_position IF NOT EXISTS FOR (p:Player) ON p.currentPosition;
CREATE INDEX path_difficulty IF NOT EXISTS FOR (path:Path) ON path.difficulty;

// Create sample door nodes for initial testing
CREATE (d1:Door {
  id: 'door_001',
  content: 'You find yourself locked in a room with only a rubber duck, a paperclip, and a motivational poster. How do you escape?',
  theme: 'escape',
  difficulty: 3,
  expectedSolutions: ['creative', 'logical', 'humorous']
});

CREATE (d2:Door {
  id: 'door_002', 
  content: 'Your pet goldfish has started giving you life advice. It seems surprisingly wise. What do you do?',
  theme: 'absurd',
  difficulty: 2,
  expectedSolutions: ['creative', 'humorous', 'philosophical']
});

CREATE (d3:Door {
  id: 'door_003',
  content: 'You discover that your shadow has been following someone else all day. How do you get it back?',
  theme: 'surreal',
  difficulty: 4,
  expectedSolutions: ['creative', 'imaginative', 'problem-solving']
});

CREATE (d4:Door {
  id: 'door_004',
  content: 'The elevator you are in starts moving sideways instead of up or down. What is your next move?',
  theme: 'unexpected',
  difficulty: 3,
  expectedSolutions: ['adaptive', 'creative', 'logical']
});

CREATE (d5:Door {
  id: 'door_005',
  content: 'You wake up to find that gravity works backwards in your house. How do you get ready for work?',
  theme: 'physics',
  difficulty: 5,
  expectedSolutions: ['practical', 'creative', 'scientific']
});

// Create sample paths with different difficulties
CREATE (easy_path:Path {
  id: 'path_easy_001',
  totalDoors: 3,
  difficulty: 'easy',
  theme: 'general'
});

CREATE (medium_path:Path {
  id: 'path_medium_001', 
  totalDoors: 5,
  difficulty: 'medium',
  theme: 'general'
});

CREATE (hard_path:Path {
  id: 'path_hard_001',
  totalDoors: 8,
  difficulty: 'hard',
  theme: 'general'
});

// Create door relationships based on scoring thresholds
// High score (70+) leads to easier/shorter paths
MATCH (d1:Door {id: 'door_001'}), (d2:Door {id: 'door_002'})
CREATE (d1)-[:LEADS_TO {scoreThreshold: 70, pathType: 'short'}]->(d2);

MATCH (d2:Door {id: 'door_002'}), (d4:Door {id: 'door_004'})
CREATE (d2)-[:LEADS_TO {scoreThreshold: 70, pathType: 'short'}]->(d4);

// Medium score (30-69) leads to standard paths
MATCH (d1:Door {id: 'door_001'}), (d3:Door {id: 'door_003'})
CREATE (d1)-[:LEADS_TO {scoreThreshold: 30, pathType: 'standard'}]->(d3);

MATCH (d3:Door {id: 'door_003'}), (d4:Door {id: 'door_004'})
CREATE (d3)-[:LEADS_TO {scoreThreshold: 30, pathType: 'standard'}]->(d4);

MATCH (d4:Door {id: 'door_004'}), (d5:Door {id: 'door_005'})
CREATE (d4)-[:LEADS_TO {scoreThreshold: 30, pathType: 'standard'}]->(d5);

// Low score (below 30) leads to longer/harder paths
MATCH (d1:Door {id: 'door_001'}), (d5:Door {id: 'door_005'})
CREATE (d1)-[:LEADS_TO {scoreThreshold: 0, pathType: 'long'}]->(d5);

MATCH (d5:Door {id: 'door_005'}), (d3:Door {id: 'door_003'})
CREATE (d5)-[:LEADS_TO {scoreThreshold: 0, pathType: 'long'}]->(d3);

// Associate doors with paths
MATCH (easy_path:Path {id: 'path_easy_001'}), (d1:Door {id: 'door_001'})
CREATE (easy_path)-[:CONTAINS {position: 1}]->(d1);

MATCH (easy_path:Path {id: 'path_easy_001'}), (d2:Door {id: 'door_002'})
CREATE (easy_path)-[:CONTAINS {position: 2}]->(d2);

MATCH (easy_path:Path {id: 'path_easy_001'}), (d4:Door {id: 'door_004'})
CREATE (easy_path)-[:CONTAINS {position: 3}]->(d4);

MATCH (medium_path:Path {id: 'path_medium_001'}), (d1:Door {id: 'door_001'})
CREATE (medium_path)-[:CONTAINS {position: 1}]->(d1);

MATCH (medium_path:Path {id: 'path_medium_001'}), (d3:Door {id: 'door_003'})
CREATE (medium_path)-[:CONTAINS {position: 2}]->(d3);

MATCH (medium_path:Path {id: 'path_medium_001'}), (d4:Door {id: 'door_004'})
CREATE (medium_path)-[:CONTAINS {position: 3}]->(d4);

MATCH (medium_path:Path {id: 'path_medium_001'}), (d5:Door {id: 'door_005'})
CREATE (medium_path)-[:CONTAINS {position: 4}]->(d5);

MATCH (medium_path:Path {id: 'path_medium_001'}), (d2:Door {id: 'door_002'})
CREATE (medium_path)-[:CONTAINS {position: 5}]->(d2);

// Create procedures for common path operations
// Note: These would be implemented as stored procedures in a production environment