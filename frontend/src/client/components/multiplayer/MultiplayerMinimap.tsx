import React, { useEffect, useState } from 'react';
import type { MultiplayerRoom, MultiplayerPlayer } from '../../../shared/types/multiplayer';

interface MultiplayerMinimapProps {
  room: MultiplayerRoom;
  className?: string;
}

interface AnimatedPlayer extends MultiplayerPlayer {
  animatedX: number;
  animatedY: number;
  isAnimating: boolean;
}

export const MultiplayerMinimap: React.FC<MultiplayerMinimapProps> = ({
  room,
  className = ''
}) => {
  const [animatedPlayers, setAnimatedPlayers] = useState<AnimatedPlayer[]>([]);
  const [raceInProgress, setRaceInProgress] = useState(false);

  // Initialize animated players
  useEffect(() => {
    setAnimatedPlayers(room.players.map(player => ({
      ...player,
      animatedX: player.position.x,
      animatedY: player.position.y,
      isAnimating: false
    })));
  }, [room.players.length]);

  // Animate player movements
  useEffect(() => {
    const updatedPlayers = room.players.map(player => {
      const existing = animatedPlayers.find(ap => ap.id === player.id);
      if (existing) {
        // Check if position changed
        if (existing.position.x !== player.position.x || existing.position.y !== player.position.y) {
          return {
            ...player,
            animatedX: existing.animatedX,
            animatedY: existing.animatedY,
            isAnimating: true
          };
        }
        return {
          ...player,
          animatedX: existing.animatedX,
          animatedY: existing.animatedY,
          isAnimating: existing.isAnimating
        };
      }
      return {
        ...player,
        animatedX: player.position.x,
        animatedY: player.position.y,
        isAnimating: false
      };
    });

    setAnimatedPlayers(updatedPlayers);

    // Animate to new positions
    const animationTimer = setTimeout(() => {
      setAnimatedPlayers(prev => prev.map(player => {
        const roomPlayer = room.players.find(rp => rp.id === player.id);
        if (roomPlayer && player.isAnimating) {
          return {
            ...roomPlayer,
            animatedX: roomPlayer.position.x,
            animatedY: roomPlayer.position.y,
            isAnimating: false
          };
        }
        return player;
      }));
    }, 100);

    return () => clearTimeout(animationTimer);
  }, [room.players]);

  // Handle race animations
  useEffect(() => {
    if (room.gameState === 'racing') {
      setRaceInProgress(true);
      // Race animation lasts 3 seconds
      const raceTimer = setTimeout(() => {
        setRaceInProgress(false);
      }, 3000);
      return () => clearTimeout(raceTimer);
    }
  }, [room.gameState]);

  const getPathColor = (pathLength: number) => {
    if (pathLength <= 3) return '#10B981'; // Green - short path
    if (pathLength <= 5) return '#F59E0B'; // Yellow - medium path
    return '#EF4444'; // Red - long path
  };

  const getPlayerRank = (player: MultiplayerPlayer) => {
    const sortedPlayers = [...room.players].sort((a, b) => {
      // Sort by current door (progress) first, then by total score
      if (a.position.currentDoor !== b.position.currentDoor) {
        return b.position.currentDoor - a.position.currentDoor;
      }
      return b.totalScore - a.totalScore;
    });
    return sortedPlayers.findIndex(p => p.id === player.id) + 1;
  };

  const mapWidth = 800;
  const mapHeight = 400;
  const pathY = mapHeight / 2;
  const startX = 50;
  const endX = mapWidth - 50;
  const pathLength = endX - startX;

  return (
    <div className={`bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl p-4 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">Race Progress</h3>
        <div className="text-white/70 text-sm">
          {room.gameState === 'racing' ? '🏁 Racing!' : 
           room.gameState === 'playing' ? '🎮 In Progress' : 
           room.gameState === 'reviewing' ? '📊 Reviewing' : 
           '⏳ Waiting'}
        </div>
      </div>

      {/* Race Track */}
      <div className="relative bg-black/30 rounded-lg overflow-hidden" style={{ height: mapHeight }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
          {/* Background Grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Main Race Path */}
          <line 
            x1={startX} 
            y1={pathY} 
            x2={endX} 
            y2={pathY} 
            stroke="rgba(255,255,255,0.3)" 
            strokeWidth="4" 
            strokeDasharray="10,5"
          />

          {/* Start Line */}
          <line 
            x1={startX} 
            y1={pathY - 30} 
            x2={startX} 
            y2={pathY + 30} 
            stroke="#10B981" 
            strokeWidth="4"
          />
          <text x={startX} y={pathY - 40} fill="#10B981" fontSize="14" textAnchor="middle" fontWeight="bold">
            START
          </text>

          {/* Finish Line */}
          <line 
            x1={endX} 
            y1={pathY - 30} 
            x2={endX} 
            y2={pathY + 30} 
            stroke="#EF4444" 
            strokeWidth="4"
          />
          <text x={endX} y={pathY - 40} fill="#EF4444" fontSize="14" textAnchor="middle" fontWeight="bold">
            FINISH
          </text>

          {/* Door Markers */}
          {Array.from({ length: 7 }, (_, i) => {
            const doorX = startX + (pathLength / 6) * i;
            if (i === 0 || i === 6) return null; // Skip start and end
            return (
              <g key={i}>
                <circle 
                  cx={doorX} 
                  cy={pathY} 
                  r="8" 
                  fill="rgba(255,255,255,0.2)" 
                  stroke="rgba(255,255,255,0.5)" 
                  strokeWidth="2"
                />
                <text 
                  x={doorX} 
                  y={pathY + 25} 
                  fill="rgba(255,255,255,0.7)" 
                  fontSize="10" 
                  textAnchor="middle"
                >
                  {i}
                </text>
              </g>
            );
          })}

          {/* Player Avatars */}
          {animatedPlayers.map((player, index) => {
            const playerX = startX + (player.animatedX / 100) * pathLength;
            const playerY = pathY + (index - (animatedPlayers.length - 1) / 2) * 25; // Spread players vertically
            const rank = getPlayerRank(player);
            
            return (
              <g key={player.id}>
                {/* Player Path (individual) */}
                <line 
                  x1={startX} 
                  y1={playerY} 
                  x2={startX + (player.position.pathLength / 10) * pathLength} 
                  y2={playerY} 
                  stroke={getPathColor(player.position.pathLength)} 
                  strokeWidth="2" 
                  opacity="0.6"
                />

                {/* Player Avatar */}
                <g 
                  className={`transition-all duration-500 ${player.isAnimating ? 'animate-pulse' : ''} ${raceInProgress ? 'animate-bounce' : ''}`}
                  transform={`translate(${playerX}, ${playerY})`}
                >
                  {/* Avatar Background */}
                  <circle 
                    r="18" 
                    fill={player.avatar.color} 
                    stroke="white" 
                    strokeWidth="2"
                    opacity="0.9"
                  />
                  
                  {/* Avatar Emoji */}
                  <text 
                    textAnchor="middle" 
                    dominantBaseline="central" 
                    fontSize="16"
                  >
                    {player.avatar.emoji}
                  </text>

                  {/* Rank Badge */}
                  <circle 
                    cx="12" 
                    cy="-12" 
                    r="8" 
                    fill={rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#6B7280'} 
                    stroke="white" 
                    strokeWidth="1"
                  />
                  <text 
                    x="12" 
                    y="-12" 
                    textAnchor="middle" 
                    dominantBaseline="central" 
                    fontSize="10" 
                    fontWeight="bold" 
                    fill="white"
                  >
                    {rank}
                  </text>

                  {/* Movement Trail */}
                  {player.position.isMoving && (
                    <g opacity="0.7">
                      <text x="-25" y="0" fontSize="12" className="animate-ping">
                        {player.avatar.trail}
                      </text>
                      <text x="-35" y="0" fontSize="10" className="animate-ping" style={{ animationDelay: '0.2s' }}>
                        {player.avatar.trail}
                      </text>
                    </g>
                  )}
                </g>

                {/* Player Name */}
                <text 
                  x={playerX} 
                  y={playerY + 35} 
                  fill="white" 
                  fontSize="12" 
                  textAnchor="middle" 
                  fontWeight="bold"
                >
                  {player.username}
                </text>

                {/* Score Display */}
                <text 
                  x={playerX} 
                  y={playerY + 50} 
                  fill="rgba(255,255,255,0.8)" 
                  fontSize="10" 
                  textAnchor="middle"
                >
                  Score: {player.totalScore}
                </text>
              </g>
            );
          })}

          {/* Race Effects */}
          {raceInProgress && (
            <g>
              {/* Confetti */}
              {Array.from({ length: 20 }, (_, i) => (
                <circle 
                  key={i}
                  cx={Math.random() * mapWidth} 
                  cy={Math.random() * mapHeight} 
                  r="3" 
                  fill={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)]} 
                  className="animate-ping"
                  style={{ animationDelay: `${Math.random() * 2}s` }}
                />
              ))}
              
              {/* Finish Line Flash */}
              <line 
                x1={endX} 
                y1={pathY - 50} 
                x2={endX} 
                y2={pathY + 50} 
                stroke="#FFD700" 
                strokeWidth="8" 
                className="animate-pulse"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Player Stats */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {room.players.map((player) => {
          const rank = getPlayerRank(player);
          return (
            <div 
              key={player.id} 
              className="bg-white/10 rounded-lg p-2 text-center border border-white/20"
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                  style={{ backgroundColor: player.avatar.color }}
                >
                  {player.avatar.emoji}
                </div>
                <span className="text-white text-sm font-semibold truncate">
                  {player.username}
                </span>
              </div>
              <div className="text-xs text-white/70">
                <div>Rank: #{rank}</div>
                <div>Doors: {player.position.currentDoor}</div>
                <div>Score: {player.totalScore}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Game State Info */}
      {room.gameState === 'finished' && (
        <div className="mt-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-4 text-center">
          <div className="text-yellow-200 font-bold text-lg mb-2">
            🏆 Game Complete!
          </div>
          <div className="text-white">
            Winner: {room.players.find(p => getPlayerRank(p) === 1)?.username}
          </div>
        </div>
      )}
    </div>
  );
};