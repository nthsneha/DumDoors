import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from neo4j import GraphDatabase, Driver
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class Neo4jService:
    """Service for managing Neo4j graph database operations"""
    
    def __init__(self):
        self.driver: Optional[Driver] = None
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._initialize_connection()
    
    def _initialize_connection(self):
        """Initialize Neo4j connection"""
        try:
            uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            username = os.getenv("NEO4J_USERNAME", "neo4j")
            password = os.getenv("NEO4J_PASSWORD", "password")
            
            self.driver = GraphDatabase.driver(uri, auth=(username, password))
            
            # Test connection
            with self.driver.session() as session:
                session.run("RETURN 1")
            
            logger.info("Neo4j connection established successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            self.driver = None
    
    async def create_door_node(self, door_id: str, content: str, theme: str, difficulty: str) -> bool:
        """Create a door node in the graph"""
        if not self.driver:
            return False
        
        try:
            query = """
            MERGE (d:Door {id: $door_id})
            SET d.content = $content,
                d.theme = $theme,
                d.difficulty = $difficulty,
                d.created_at = datetime()
            RETURN d
            """
            
            def run_query(tx):
                return tx.run(query, door_id=door_id, content=content, theme=theme, difficulty=difficulty)
            
            loop = asyncio.get_event_loop()
            with self.driver.session() as session:
                await loop.run_in_executor(self.executor, session.execute_write, run_query)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create door node: {e}")
            return False
    
    async def create_path_relationship(self, from_door_id: str, to_door_id: str, score_threshold: int, path_type: str) -> bool:
        """Create a path relationship between doors based on score threshold"""
        if not self.driver:
            return False
        
        try:
            query = """
            MATCH (from:Door {id: $from_door_id})
            MATCH (to:Door {id: $to_door_id})
            MERGE (from)-[r:LEADS_TO {score_threshold: $score_threshold, path_type: $path_type}]->(to)
            RETURN r
            """
            
            def run_query(tx):
                return tx.run(query, 
                            from_door_id=from_door_id, 
                            to_door_id=to_door_id, 
                            score_threshold=score_threshold,
                            path_type=path_type)
            
            loop = asyncio.get_event_loop()
            with self.driver.session() as session:
                await loop.run_in_executor(self.executor, session.execute_write, run_query)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create path relationship: {e}")
            return False
    
    async def get_next_door_by_score(self, current_door_id: str, player_score: float) -> Optional[Dict[str, Any]]:
        """Get the next door based on player score and path logic"""
        if not self.driver:
            return None
        
        try:
            # Path logic: 70+ = shorter path, 30- = longer path
            if player_score >= 70:
                path_type = "shorter_path"
            elif player_score <= 30:
                path_type = "longer_path"
            else:
                path_type = "normal_path"
            
            query = """
            MATCH (current:Door {id: $current_door_id})-[r:LEADS_TO]->(next:Door)
            WHERE r.path_type = $path_type 
               OR (r.path_type = 'normal_path' AND $path_type = 'normal_path')
            RETURN next.id as door_id, next.content as content, next.theme as theme, 
                   next.difficulty as difficulty, r.score_threshold as threshold
            ORDER BY r.score_threshold DESC
            LIMIT 1
            """
            
            def run_query(tx):
                result = tx.run(query, current_door_id=current_door_id, path_type=path_type)
                return [record.data() for record in result]
            
            loop = asyncio.get_event_loop()
            with self.driver.session() as session:
                results = await loop.run_in_executor(self.executor, session.execute_read, run_query)
            
            return results[0] if results else None
            
        except Exception as e:
            logger.error(f"Failed to get next door: {e}")
            return None
    
    async def create_player_path(self, player_id: str, session_id: str, current_door_id: str) -> bool:
        """Create or update player path tracking"""
        if not self.driver:
            return False
        
        try:
            query = """
            MERGE (p:Player {id: $player_id})
            MERGE (s:GameSession {id: $session_id})
            MERGE (d:Door {id: $current_door_id})
            MERGE (p)-[r:CURRENTLY_AT]->(d)
            SET r.updated_at = datetime()
            MERGE (p)-[:IN_SESSION]->(s)
            RETURN p, r, d
            """
            
            def run_query(tx):
                return tx.run(query, 
                            player_id=player_id, 
                            session_id=session_id, 
                            current_door_id=current_door_id)
            
            loop = asyncio.get_event_loop()
            with self.driver.session() as session:
                await loop.run_in_executor(self.executor, session.execute_write, run_query)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create player path: {e}")
            return False
    
    async def get_player_progress(self, player_id: str) -> Optional[Dict[str, Any]]:
        """Get player's current progress and path information"""
        if not self.driver:
            return None
        
        try:
            query = """
            MATCH (p:Player {id: $player_id})-[r:CURRENTLY_AT]->(current:Door)
            OPTIONAL MATCH (current)-[next_rel:LEADS_TO]->(next_door:Door)
            RETURN current.id as current_door_id,
                   current.content as current_content,
                   current.theme as current_theme,
                   collect({
                       door_id: next_door.id,
                       content: next_door.content,
                       path_type: next_rel.path_type,
                       score_threshold: next_rel.score_threshold
                   }) as next_doors
            """
            
            def run_query(tx):
                result = tx.run(query, player_id=player_id)
                return [record.data() for record in result]
            
            loop = asyncio.get_event_loop()
            with self.driver.session() as session:
                results = await loop.run_in_executor(self.executor, session.execute_read, run_query)
            
            return results[0] if results else None
            
        except Exception as e:
            logger.error(f"Failed to get player progress: {e}")
            return None
    
    async def calculate_remaining_doors(self, player_id: str, target_door_id: str = "final") -> int:
        """Calculate how many doors remain for a player to reach the target"""
        if not self.driver:
            return -1
        
        try:
            query = """
            MATCH (p:Player {id: $player_id})-[:CURRENTLY_AT]->(current:Door)
            MATCH path = shortestPath((current)-[:LEADS_TO*]->(target:Door {id: $target_door_id}))
            RETURN length(path) as remaining_doors
            """
            
            def run_query(tx):
                result = tx.run(query, player_id=player_id, target_door_id=target_door_id)
                return [record.data() for record in result]
            
            loop = asyncio.get_event_loop()
            with self.driver.session() as session:
                results = await loop.run_in_executor(self.executor, session.execute_read, run_query)
            
            return results[0]["remaining_doors"] if results else -1
            
        except Exception as e:
            logger.error(f"Failed to calculate remaining doors: {e}")
            return -1
    
    async def initialize_game_graph(self, theme: str, difficulty: str) -> List[str]:
        """Initialize a complete game graph for a theme and difficulty"""
        if not self.driver:
            return []
        
        try:
            # Create a basic game structure with multiple paths
            door_ids = []
            
            # Create starting door
            start_door_id = f"start_{theme}_{difficulty}"
            door_ids.append(start_door_id)
            await self.create_door_node(
                start_door_id, 
                f"Welcome to the {theme} adventure! Choose your path wisely.",
                theme, 
                difficulty
            )
            
            # Create multiple path doors based on difficulty
            num_doors = {"easy": 3, "medium": 5, "hard": 7}.get(difficulty, 5)
            
            for i in range(1, num_doors + 1):
                # Normal path door
                normal_door_id = f"{theme}_{difficulty}_normal_{i}"
                door_ids.append(normal_door_id)
                await self.create_door_node(
                    normal_door_id,
                    f"Door {i} on the normal path",
                    theme,
                    difficulty
                )
                
                # Shorter path door (for high scores)
                if i > 1:  # Skip first door for shorter path
                    shorter_door_id = f"{theme}_{difficulty}_shorter_{i-1}"
                    door_ids.append(shorter_door_id)
                    await self.create_door_node(
                        shorter_door_id,
                        f"Door {i-1} on the shorter path (reward for good performance)",
                        theme,
                        difficulty
                    )
                
                # Longer path door (for low scores)
                longer_door_id = f"{theme}_{difficulty}_longer_{i+1}"
                door_ids.append(longer_door_id)
                await self.create_door_node(
                    longer_door_id,
                    f"Door {i+1} on the longer path (extra challenge)",
                    theme,
                    difficulty
                )
            
            # Create final door
            final_door_id = f"final_{theme}_{difficulty}"
            door_ids.append(final_door_id)
            await self.create_door_node(
                final_door_id,
                f"Congratulations! You've completed the {theme} challenge!",
                theme,
                difficulty
            )
            
            # Create relationships between doors
            await self._create_path_relationships(door_ids, theme, difficulty)
            
            return door_ids
            
        except Exception as e:
            logger.error(f"Failed to initialize game graph: {e}")
            return []
    
    async def _create_path_relationships(self, door_ids: List[str], theme: str, difficulty: str):
        """Create the path relationships between doors"""
        try:
            # This is a simplified path creation - in a real game, this would be more complex
            for i, door_id in enumerate(door_ids[:-1]):  # Exclude final door
                next_door_id = door_ids[i + 1] if i + 1 < len(door_ids) else door_ids[-1]
                
                # Create normal path
                await self.create_path_relationship(door_id, next_door_id, 50, "normal_path")
                
                # Create shorter path (skip doors for high scores)
                if i + 2 < len(door_ids):
                    skip_door_id = door_ids[i + 2]
                    await self.create_path_relationship(door_id, skip_door_id, 70, "shorter_path")
                
                # Create longer path (extra doors for low scores)
                # This would connect to additional challenge doors
                await self.create_path_relationship(door_id, next_door_id, 30, "longer_path")
                
        except Exception as e:
            logger.error(f"Failed to create path relationships: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Neo4j connection health"""
        if not self.driver:
            return {"status": "unhealthy", "error": "No driver connection"}
        
        try:
            query = "RETURN 1 as test"
            
            def run_query(tx):
                result = tx.run(query)
                return [record.data() for record in result]
            
            loop = asyncio.get_event_loop()
            with self.driver.session() as session:
                await loop.run_in_executor(self.executor, session.execute_read, run_query)
            
            return {"status": "healthy", "database": "neo4j"}
            
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
    
    def close(self):
        """Close the Neo4j connection"""
        if self.driver:
            self.driver.close()
            self.executor.shutdown(wait=True)