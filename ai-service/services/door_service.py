import asyncio
import logging
import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
import redis.asyncio as redis

from models.door import Door, Theme, DifficultyLevel, CacheStats
from services.ai_client import AIClient

logger = logging.getLogger(__name__)

class DoorService:
    """Service for managing door generation and caching"""
    
    def __init__(self, ai_client: AIClient):
        self.ai_client = ai_client
        self.redis_client = None
        self.cache_enabled = False
        self._initialize_cache()
        
        # Cache statistics
        self.cache_hits = 0
        self.cache_misses = 0
    
    def _initialize_cache(self):
        """Initialize Redis cache connection"""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.cache_enabled = True
            logger.info("Redis cache initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis cache: {e}")
            self.cache_enabled = False
    
    async def generate_door(self, theme: Theme, difficulty: DifficultyLevel, context: Optional[Dict[str, Any]] = None) -> Door:
        """Generate a new door scenario"""
        try:
            # Check cache first
            cache_key = f"door:{theme.value}:{difficulty.value}:{hash(str(context))}"
            cached_door = await self._get_from_cache(cache_key)
            
            if cached_door:
                self.cache_hits += 1
                return cached_door
            
            self.cache_misses += 1
            
            # Generate new door using AI
            door_content = await self.ai_client.generate_door_scenario(theme, difficulty, context)
            
            # Create door object
            door = Door(
                door_id=str(uuid.uuid4()),
                content=door_content,
                theme=theme,
                difficulty=difficulty,
                expected_solution_types=self._get_expected_solution_types(theme, difficulty),
                context=context,
                created_at=datetime.utcnow()
            )
            
            # Cache the door
            await self._store_in_cache(cache_key, door)
            
            return door
            
        except Exception as e:
            logger.error(f"Door generation failed: {e}")
            raise
    
    async def get_themed_doors(self, theme: str, count: int = 5) -> List[Door]:
        """Get multiple doors for a specific theme"""
        try:
            theme_enum = Theme(theme.lower())
            doors = []
            
            # Generate doors with varying difficulties
            difficulties = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD]
            
            for i in range(count):
                difficulty = difficulties[i % len(difficulties)]
                door = await self.generate_door(theme_enum, difficulty)
                doors.append(door)
            
            return doors
            
        except Exception as e:
            logger.error(f"Themed doors generation failed: {e}")
            raise
    
    async def get_cache_stats(self) -> CacheStats:
        """Get cache statistics"""
        try:
            total_requests = self.cache_hits + self.cache_misses
            hit_rate = (self.cache_hits / total_requests * 100) if total_requests > 0 else 0
            
            # Get memory usage from Redis
            memory_usage = 0
            total_doors = 0
            
            if self.cache_enabled and self.redis_client:
                try:
                    info = await self.redis_client.info("memory")
                    memory_usage = info.get("used_memory", 0) / (1024 * 1024)  # Convert to MB
                    
                    # Count doors in cache
                    door_keys = await self.redis_client.keys("door:*")
                    total_doors = len(door_keys)
                except Exception as e:
                    logger.warning(f"Failed to get Redis stats: {e}")
            
            return CacheStats(
                total_doors=total_doors,
                cache_hits=self.cache_hits,
                cache_misses=self.cache_misses,
                hit_rate=hit_rate,
                memory_usage_mb=memory_usage
            )
            
        except Exception as e:
            logger.error(f"Cache stats retrieval failed: {e}")
            raise
    
    async def _get_from_cache(self, key: str) -> Optional[Door]:
        """Get door from cache"""
        if not self.cache_enabled or not self.redis_client:
            return None
        
        try:
            cached_data = await self.redis_client.get(key)
            if cached_data:
                import json
                door_dict = json.loads(cached_data)
                return Door(**door_dict)
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")
        
        return None
    
    async def _store_in_cache(self, key: str, door: Door, ttl: int = 3600):
        """Store door in cache"""
        if not self.cache_enabled or not self.redis_client:
            return
        
        try:
            import json
            door_dict = door.model_dump()
            # Convert datetime to string for JSON serialization
            door_dict["created_at"] = door_dict["created_at"].isoformat()
            
            await self.redis_client.setex(key, ttl, json.dumps(door_dict))
        except Exception as e:
            logger.warning(f"Cache storage failed: {e}")
    
    def _get_expected_solution_types(self, theme: Theme, difficulty: DifficultyLevel) -> List[str]:
        """Get expected solution types based on theme and difficulty"""
        base_types = {
            Theme.WORKPLACE: ["negotiation", "delegation", "problem-solving", "communication"],
            Theme.SOCIAL: ["empathy", "communication", "conflict-resolution", "leadership"],
            Theme.ADVENTURE: ["resourcefulness", "courage", "planning", "adaptability"],
            Theme.MYSTERY: ["deduction", "investigation", "analysis", "intuition"],
            Theme.COMEDY: ["humor", "creativity", "timing", "wit"],
            Theme.SURVIVAL: ["resourcefulness", "prioritization", "risk-assessment", "adaptation"],
            Theme.RANDOM: ["creativity", "flexibility", "innovation", "lateral-thinking"]
        }
        
        types = base_types.get(theme, ["creativity", "problem-solving"])
        
        # Add complexity based on difficulty
        if difficulty == DifficultyLevel.HARD:
            types.extend(["strategic-thinking", "multi-step-planning"])
        elif difficulty == DifficultyLevel.MEDIUM:
            types.append("analytical-thinking")
        
        return types