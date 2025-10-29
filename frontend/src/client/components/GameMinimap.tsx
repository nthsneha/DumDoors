import React from 'react';

interface PathNode {
  id: string;
  position: number;
  type: 'start' | 'door' | 'end';
  status: 'completed' | 'current' | 'future';
  score?: number;
  color?: 'red' | 'yellow' | 'green';
  x?: number; // X position on the map (0-100)
  y?: number; // Y position on the map (0-100) - deviation from center path
}

interface GamePath {
  nodes: PathNode[];
  totalLength: number;
  currentPosition: number;
}

interface GameMinimapProps {
  gamePath: GamePath;
  className?: string;
}

// Terrain and landmark definitions
const TERRAIN_FEATURES = [
  { type: 'mountain', x: 15, y: 20, size: 25, emoji: '🏔️' },
  { type: 'forest', x: 35, y: 70, size: 30, emoji: '🌲' },
  { type: 'lake', x: 60, y: 25, size: 20, emoji: '🏞️' },
  { type: 'desert', x: 75, y: 65, size: 25, emoji: '🏜️' },
  { type: 'village', x: 45, y: 45, size: 15, emoji: '🏘️' },
];

const LANDMARKS = [
  { name: 'Starting Village', x: 8, y: 50, emoji: '🏠' },
  { name: 'Ancient Bridge', x: 25, y: 40, emoji: '🌉' },
  { name: 'Mystic Grove', x: 40, y: 60, emoji: '🌳' },
  { name: 'Crystal Caves', x: 55, y: 35, emoji: '💎' },
  { name: 'Sky Temple', x: 70, y: 55, emoji: '🏛️' },
  { name: 'Final Destination', x: 92, y: 50, emoji: '🏰' },
];

export const GameMinimap: React.FC<GameMinimapProps> = ({ gamePath, className = '' }) => {
  const mapWidth = 500;
  const mapHeight = 300;
  
  // Generate a realistic winding path across the geographic map
  const generateGeographicPath = () => {
    const pathPoints = [];
    const totalSteps = gamePath.totalLength + 1; // +1 for start to end
    
    // Define key waypoints that create a natural journey
    const waypoints = [
      { x: 8, y: 50 },   // Start: Village
      { x: 25, y: 40 },  // Bridge
      { x: 40, y: 60 },  // Grove  
      { x: 55, y: 35 },  // Caves
      { x: 70, y: 55 },  // Temple
      { x: 92, y: 50 },  // End: Castle
    ];
    
    // Interpolate between waypoints to create smooth path
    for (let i = 0; i <= totalSteps; i++) {
      const progress = i / totalSteps;
      const waypointIndex = progress * (waypoints.length - 1);
      const currentWaypointIndex = Math.floor(waypointIndex);
      const nextWaypointIndex = Math.min(currentWaypointIndex + 1, waypoints.length - 1);
      const localProgress = waypointIndex - currentWaypointIndex;
      
      const currentWaypoint = waypoints[currentWaypointIndex];
      const nextWaypoint = waypoints[nextWaypointIndex];
      
      if (!currentWaypoint || !nextWaypoint) continue;
      
      // Smooth interpolation with some natural variation
      const baseX = currentWaypoint.x + (nextWaypoint.x - currentWaypoint.x) * localProgress;
      const baseY = currentWaypoint.y + (nextWaypoint.y - currentWaypoint.y) * localProgress;
      
      // Add some natural path variation (not too much)
      const variation = Math.sin(progress * Math.PI * 4) * 3;
      
      pathPoints.push({
        x: baseX,
        y: baseY + variation,
        step: i
      });
    }
    
    return pathPoints;
  };

  const pathPoints = generateGeographicPath();
  
  // Get position for a specific node
  const getNodePosition = (node: PathNode) => {
    if (node.type === 'start') {
      return pathPoints[0] || { x: 8, y: 50 };
    }
    if (node.type === 'end') {
      return pathPoints[pathPoints.length - 1] || { x: 92, y: 50 };
    }
    
    // For doors, find the corresponding path point
    const pathIndex = Math.min(node.position, pathPoints.length - 1);
    return pathPoints[pathIndex] || { x: 50, y: 50 };
  };

  // Draw terrain features
  const drawTerrain = () => {
    return TERRAIN_FEATURES.map((feature, index) => {
      const x = (feature.x / 100) * mapWidth;
      const y = (feature.y / 100) * mapHeight;
      const size = (feature.size / 100) * Math.min(mapWidth, mapHeight);
      
      let fillColor = '#4ade80'; // Default green
      if (feature.type === 'mountain') fillColor = '#6b7280';
      if (feature.type === 'lake') fillColor = '#3b82f6';
      if (feature.type === 'desert') fillColor = '#f59e0b';
      if (feature.type === 'village') fillColor = '#8b5cf6';
      
      return (
        <g key={`terrain-${index}`}>
          <circle
            cx={x}
            cy={y}
            r={size / 2}
            fill={fillColor}
            opacity="0.3"
            className="transition-all duration-300"
          />
          <text
            x={x}
            y={y + 5}
            textAnchor="middle"
            className="text-lg"
            style={{ fontSize: '16px' }}
          >
            {feature.emoji}
          </text>
        </g>
      );
    });
  };

  // Draw the complete path as a winding road
  const drawPath = () => {
    if (pathPoints.length < 2) return null;
    
    // Create path string for the main route
    const firstPoint = pathPoints[0];
    if (!firstPoint) return null;
    
    let pathString = `M ${(firstPoint.x / 100) * mapWidth} ${(firstPoint.y / 100) * mapHeight}`;
    
    for (let i = 1; i < pathPoints.length; i++) {
      const point = pathPoints[i];
      if (point) {
        const x = (point.x / 100) * mapWidth;
        const y = (point.y / 100) * mapHeight;
        pathString += ` L ${x} ${y}`;
      }
    }
    
    // Determine how much of the path to show as completed
    const completedSteps = gamePath.currentPosition + 1;
    let completedPathString = `M ${(firstPoint.x / 100) * mapWidth} ${(firstPoint.y / 100) * mapHeight}`;
    
    for (let i = 1; i <= Math.min(completedSteps, pathPoints.length - 1); i++) {
      const point = pathPoints[i];
      if (point) {
        const x = (point.x / 100) * mapWidth;
        const y = (point.y / 100) * mapHeight;
        completedPathString += ` L ${x} ${y}`;
      }
    }
    
    return (
      <g>
        {/* Full path (faded) */}
        <path
          d={pathString}
          stroke="#4b5563"
          strokeWidth="4"
          fill="none"
          opacity="0.3"
          strokeDasharray="8,4"
        />
        {/* Completed path (bright) */}
        <path
          d={completedPathString}
          stroke="#3b82f6"
          strokeWidth="4"
          fill="none"
          opacity="0.8"
          className="animate-pulse"
        />
      </g>
    );
  };

  // Draw landmarks
  const drawLandmarks = () => {
    return LANDMARKS.map((landmark, index) => {
      const x = (landmark.x / 100) * mapWidth;
      const y = (landmark.y / 100) * mapHeight;
      
      return (
        <g key={`landmark-${index}`}>
          <circle
            cx={x}
            cy={y}
            r="12"
            fill="#1f2937"
            stroke="#3b82f6"
            strokeWidth="2"
            opacity="0.8"
          />
          <text
            x={x}
            y={y + 4}
            textAnchor="middle"
            className="text-sm"
            style={{ fontSize: '14px' }}
          >
            {landmark.emoji}
          </text>
          <text
            x={x}
            y={y - 20}
            textAnchor="middle"
            className="text-xs fill-white font-medium"
            style={{ fontSize: '8px' }}
          >
            {landmark.name}
          </text>
        </g>
      );
    });
  };

  return (
    <div className={`bg-black/20 backdrop-blur-lg rounded-lg p-4 border border-white/20 ${className}`}>
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        🗺️ Adventure Map
      </h3>
      
      {/* SVG Geographic Map */}
      <div className="relative bg-gradient-to-br from-green-900/30 via-blue-900/20 to-yellow-900/20 rounded-lg p-3 mb-4 border border-blue-400/30">
        <svg width={mapWidth} height={mapHeight} className="w-full h-auto">
          {/* Background gradient for terrain */}
          <defs>
            <radialGradient id="terrainGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#065f46" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#1e40af" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#92400e" stopOpacity="0.3" />
            </radialGradient>
            <pattern id="mapTexture" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill="#3b82f6" opacity="0.1"/>
            </pattern>
          </defs>
          
          {/* Map background */}
          <rect width="100%" height="100%" fill="url(#terrainGradient)" />
          <rect width="100%" height="100%" fill="url(#mapTexture)" />
          
          {/* Terrain features */}
          {drawTerrain()}
          
          {/* Main path */}
          {drawPath()}
          
          {/* Landmarks */}
          {drawLandmarks()}
          
          {/* Player and doors */}
          {gamePath.nodes.map((node) => {
            const position = getNodePosition(node);
            if (!position) return null;
            const x = (position.x / 100) * mapWidth;
            const y = (position.y / 100) * mapHeight;
            
            if (node.type === 'start') {
              return (
                <g key={node.id}>
                  <circle cx={x} cy={y} r="8" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                  <text x={x} y={y + 3} textAnchor="middle" className="text-xs fill-white font-bold" style={{ fontSize: '10px' }}>🏠</text>
                </g>
              );
            }
            
            if (node.type === 'end') {
              return (
                <g key={node.id}>
                  <circle cx={x} cy={y} r="10" fill="#1e40af" stroke="#ffffff" strokeWidth="2" />
                  <text x={x} y={y + 4} textAnchor="middle" className="text-sm fill-white font-bold" style={{ fontSize: '12px' }}>🏰</text>
                </g>
              );
            }
            
            // Door nodes
            if (node.status === 'current') {
              return (
                <g key={node.id}>
                  {/* Player indicator */}
                  <circle cx={x} cy={y} r="12" fill="#3b82f6" stroke="#ffffff" strokeWidth="3" className="animate-pulse" />
                  <text x={x} y={y + 4} textAnchor="middle" className="text-sm fill-white font-bold" style={{ fontSize: '12px' }}>🚶</text>
                  <text x={x} y={y - 18} textAnchor="middle" className="text-xs fill-blue-200 font-medium" style={{ fontSize: '9px' }}>YOU</text>
                </g>
              );
            }
            
            if (node.status === 'completed') {
              const doorColor = node.color === 'green' ? '#22c55e' : node.color === 'yellow' ? '#eab308' : '#ef4444';
              return (
                <g key={node.id}>
                  <circle cx={x} cy={y} r="6" fill={doorColor} stroke="#ffffff" strokeWidth="2" />
                  <text x={x} y={y + 3} textAnchor="middle" className="text-xs fill-white font-bold" style={{ fontSize: '8px' }}>🚪</text>
                  {node.score && (
                    <text x={x} y={y + 20} textAnchor="middle" className="text-xs fill-gray-300" style={{ fontSize: '7px' }}>
                      {node.score}
                    </text>
                  )}
                </g>
              );
            }
            
            // Future doors
            return (
              <g key={node.id}>
                <circle cx={x} cy={y} r="4" fill="#6b7280" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
                <text x={x} y={y + 2} textAnchor="middle" className="text-xs fill-gray-400" style={{ fontSize: '6px' }}>🚪</text>
              </g>
            );
          })}
        </svg>
        
        {/* Map Legend */}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded p-2 text-xs text-gray-300">
          <div className="flex items-center gap-1 mb-1">
            <span>🚶</span>
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Good</span>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>OK</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>Poor</span>
          </div>
        </div>
        
        {/* Compass */}
        <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded-full w-12 h-12 flex items-center justify-center">
          <div className="text-white text-xs font-bold">
            <div className="text-center">N</div>
            <div className="text-center text-blue-400">↑</div>
          </div>
        </div>
      </div>

      {/* Journey Stats */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-black/30 rounded p-2 text-center">
          <div className="text-blue-400 font-bold text-lg">{gamePath.currentPosition}</div>
          <div className="text-gray-300">Doors Passed</div>
        </div>
        <div className="bg-black/30 rounded p-2 text-center">
          <div className="text-green-400 font-bold text-lg">{gamePath.totalLength - gamePath.currentPosition}</div>
          <div className="text-gray-300">Remaining</div>
        </div>
        <div className="bg-black/30 rounded p-2 text-center">
          <div className="text-yellow-400 font-bold text-lg">
            {Math.round((gamePath.currentPosition / gamePath.totalLength) * 100)}%
          </div>
          <div className="text-gray-300">Complete</div>
        </div>
      </div>
      
      {/* Current Location */}
      <div className="mt-3 pt-3 border-t border-white/20">
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-300">Current Location:</div>
          <div className="text-white font-semibold flex items-center gap-1">
            <span>🚶</span>
            {gamePath.currentPosition === 0 ? 'Starting Village' :
             gamePath.currentPosition >= gamePath.totalLength ? 'Final Destination' :
             `Door ${gamePath.currentPosition}`}
          </div>
        </div>
        
        {/* Average Score */}
        {gamePath.nodes.some(n => n.score !== undefined) && (
          <div className="flex items-center justify-between text-xs mt-2">
            <div className="text-gray-300">Journey Score:</div>
            <div className="text-white font-semibold">
              {Math.round(
                gamePath.nodes
                  .filter(n => n.score !== undefined)
                  .reduce((sum, n) => sum + (n.score || 0), 0) /
                gamePath.nodes.filter(n => n.score !== undefined).length
              )}/100
            </div>
          </div>
        )}
      </div>
    </div>
  );
};