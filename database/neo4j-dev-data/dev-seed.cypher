// Neo4j development seed data for DumDoors game paths

// Create additional development doors
CREATE (d6:Door {
  id: 'dev_door_006',
  content: 'You find that your keyboard only types in emojis. How do you write your important email?',
  theme: 'technology',
  difficulty: 3,
  expectedSolutions: ['creative', 'practical', 'humorous']
});

CREATE (d7:Door {
  id: 'dev_door_007',
  content: 'Your GPS has developed a sense of humor and keeps giving you directions to imaginary places. What do you do?',
  theme: 'technology',
  difficulty: 2,
  expectedSolutions: ['adaptive', 'humorous', 'problem-solving']
});

CREATE (d8:Door {
  id: 'dev_door_008',
  content: 'You realize that every time you sneeze, a random object in your house changes color. How do you use this power?',
  theme: 'supernatural',
  difficulty: 4,
  expectedSolutions: ['creative', 'strategic', 'imaginative']
});

// Create development paths
CREATE (dev_path_short:Path {
  id: 'dev_path_short_001',
  totalDoors: 2,
  difficulty: 'easy',
  theme: 'development'
});

CREATE (dev_path_medium:Path {
  id: 'dev_path_medium_001',
  totalDoors: 4,
  difficulty: 'medium',
  theme: 'development'
});

CREATE (dev_path_long:Path {
  id: 'dev_path_long_001',
  totalDoors: 6,
  difficulty: 'hard',
  theme: 'development'
});

// Create development door relationships
MATCH (d1:Door {id: 'door_001'}), (d6:Door {id: 'dev_door_006'})
CREATE (d1)-[:LEADS_TO {scoreThreshold: 75, pathType: 'dev_short'}]->(d6);

MATCH (d6:Door {id: 'dev_door_006'}), (d7:Door {id: 'dev_door_007'})
CREATE (d6)-[:LEADS_TO {scoreThreshold: 60, pathType: 'dev_medium'}]->(d7);

MATCH (d7:Door {id: 'dev_door_007'}), (d8:Door {id: 'dev_door_008'})
CREATE (d7)-[:LEADS_TO {scoreThreshold: 40, pathType: 'dev_long'}]->(d8);

// Associate development doors with paths
MATCH (dev_path_short:Path {id: 'dev_path_short_001'}), (d1:Door {id: 'door_001'})
CREATE (dev_path_short)-[:CONTAINS {position: 1}]->(d1);

MATCH (dev_path_short:Path {id: 'dev_path_short_001'}), (d6:Door {id: 'dev_door_006'})
CREATE (dev_path_short)-[:CONTAINS {position: 2}]->(d6);

MATCH (dev_path_medium:Path {id: 'dev_path_medium_001'}), (d1:Door {id: 'door_001'})
CREATE (dev_path_medium)-[:CONTAINS {position: 1}]->(d1);

MATCH (dev_path_medium:Path {id: 'dev_path_medium_001'}), (d6:Door {id: 'dev_door_006'})
CREATE (dev_path_medium)-[:CONTAINS {position: 2}]->(d6);

MATCH (dev_path_medium:Path {id: 'dev_path_medium_001'}), (d7:Door {id: 'dev_door_007'})
CREATE (dev_path_medium)-[:CONTAINS {position: 3}]->(d7);

MATCH (dev_path_medium:Path {id: 'dev_path_medium_001'}), (d8:Door {id: 'dev_door_008'})
CREATE (dev_path_medium)-[:CONTAINS {position: 4}]->(d8);