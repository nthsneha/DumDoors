import React from 'react';

interface PathNode {
  id: string;
  position: number;
  type: 'start' | 'door' | 'end';
  status: 'completed' | 'current' | 'future';
  score?: number;
  color?: 'red' | 'yellow' | 'green';
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

export const GameMinimap: React.FC<GameMinimapProps> = ({ gamePath, className = '' }) => {
  const mapWidth = 400;
  const mapHeight = 500;
  
  // Static isometric world layout - clean minimal theme
  const staticWorldElements = [];

  // Static path layout - isometric adventure path that never changes
  const staticPathPoints = [
    { x: 80, y: 450, type: 'start' },    // Village at bottom left
    { x: 140, y: 400, type: 'door' },    // First door
    { x: 180, y: 350, type: 'door' },    // Second door
    { x: 220, y: 300, type: 'door' },    // Third door
    { x: 260, y: 250, type: 'door' },    // Fourth door
    { x: 300, y: 200, type: 'door' },    // Fifth door
    { x: 340, y: 150, type: 'door' },    // Sixth door
    { x: 320, y: 100, type: 'end' },     // Castle at top right
  ];

  // Get visible nodes based on progress
  const getVisibleNodes = () => {
    const visibleNodes = [];
    
    for (let i = 0; i < gamePath.nodes.length && i < staticPathPoints.length; i++) {
      const node = gamePath.nodes[i];
      if (!node) continue;
      
      // Always show start
      if (node.type === 'start') {
        visibleNodes.push({ ...node, ...staticPathPoints[i] });
        continue;
      }
      
      // Show completed and current doors
      if (node.status === 'completed' || node.status === 'current') {
        visibleNodes.push({ ...node, ...staticPathPoints[i] });
        continue;
      }
      
      // Show end if we're at the final door
      if (node.type === 'end' && gamePath.currentPosition >= gamePath.totalLength - 1) {
        visibleNodes.push({ ...node, ...staticPathPoints[i] });
        continue;
      }
      
      break;
    }
    
    return visibleNodes;
  };

  const visibleNodes = getVisibleNodes();

  // Path impact indicator
  const getPathImpactMessage = () => {
    const lastCompletedNode = gamePath.nodes
      .filter(n => n.status === 'completed' && n.type === 'door')
      .pop();
    
    if (!lastCompletedNode?.score) return null;
    
    const score = lastCompletedNode.score;
    if (score >= 80) return { text: "🚀 Path Shortened!", color: "text-green-400" };
    if (score >= 60) return { text: "✨ Good Progress!", color: "text-green-300" };
    if (score <= 30) return { text: "🐌 Path Extended", color: "text-red-400" };
    if (score <= 40) return { text: "⚠️ Slower Route", color: "text-yellow-400" };
    return { text: "➡️ Normal Path", color: "text-blue-300" };
  };

  const pathImpact = getPathImpactMessage();

  // Draw static terrain (never moves)
  const drawTerrain = () => {
    return staticWorldElements.map((element, index) => {
      const key = `terrain-${index}`;
      

      
      if (element.type === 'river' || element.type === 'lake') {
        return (
          <g key={key}>
            {/* Water shadow */}
            <ellipse
              cx={element.x + 2}
              cy={element.y + 2}
              rx={element.size * 0.6}
              ry={element.size * 0.3}
              fill="rgba(0,0,0,0.2)"
            />
            {/* Water body */}
            <ellipse
              cx={element.x}
              cy={element.y}
              rx={element.size * 0.6}
              ry={element.size * 0.3}
              fill={element.color}
              opacity="0.7"
            />
            {/* Water shimmer */}
            <ellipse
              cx={element.x}
              cy={element.y}
              rx={element.size * 0.4}
              ry={element.size * 0.2}
              fill="rgba(255,255,255,0.3)"
              className="animate-pulse"
            />
          </g>
        );
      }
      
      if (element.type === 'plains') {
        return (
          <g key={key}>
            {/* Plains shadow */}
            <ellipse
              cx={element.x + 2}
              cy={element.y + 2}
              rx={element.size * 0.7}
              ry={element.size * 0.2}
              fill="rgba(0,0,0,0.1)"
            />
            {/* Plains */}
            <ellipse
              cx={element.x}
              cy={element.y}
              rx={element.size * 0.7}
              ry={element.size * 0.2}
              fill={element.color}
              opacity="0.5"
            />
          </g>
        );
      }
      
      if (element.type === 'desert') {
        return (
          <g key={key}>
            {/* Desert shadow */}
            <ellipse
              cx={element.x + 2}
              cy={element.y + 2}
              rx={element.size * 0.6}
              ry={element.size * 0.2}
              fill="rgba(0,0,0,0.15)"
            />
            {/* Desert */}
            <ellipse
              cx={element.x}
              cy={element.y}
              rx={element.size * 0.6}
              ry={element.size * 0.2}
              fill={element.color}
              opacity="0.6"
            />
            {/* Sand dunes */}
            <ellipse
              cx={element.x - element.size * 0.2}
              cy={element.y}
              rx={element.size * 0.3}
              ry={element.size * 0.1}
              fill="rgba(245, 158, 11, 0.8)"
            />
          </g>
        );
      }
      
      return null;
    });
  };

  // Draw progressive path (only shows as doors are completed)
  const drawPath = () => {
    const pathElements = [];
    
    // Only draw path segments up to the current progress
    const maxSegments = Math.min(visibleNodes.length - 1, staticPathPoints.length - 1);
    
    for (let i = 0; i < maxSegments; i++) {
      const current = staticPathPoints[i];
      const next = staticPathPoints[i + 1];
      
      // Only draw if we have completed this segment
      const currentNode = visibleNodes[i];
      const nextNode = visibleNodes[i + 1];
      
      if (!currentNode || !nextNode) continue;
      
      // Only show path if current door is completed or if next door is current/completed
      if (currentNode.status === 'completed' || nextNode.status === 'completed' || nextNode.status === 'current') {
        // Path shadow
        pathElements.push(
          <line
            key={`path-shadow-${i}`}
            x1={current.x + 2}
            y1={current.y + 2}
            x2={next.x + 2}
            y2={next.y + 2}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="8"
            strokeLinecap="round"
          />
        );
        
        // Main path
        pathElements.push(
          <line
            key={`path-${i}`}
            x1={current.x}
            y1={current.y}
            x2={next.x}
            y2={next.y}
            stroke="url(#pathGradient)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
        
        // Path highlight
        pathElements.push(
          <line
            key={`path-highlight-${i}`}
            x1={current.x}
            y1={current.y}
            x2={next.x}
            y2={next.y}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      }
    }
    
    return pathElements;
  };

  // Draw static buildings and doors (never move)
  const drawNodes = () => {
    return visibleNodes.map((node, index) => {
      const point = staticPathPoints[index];
      if (!point) return null;
      
      const x = point.x;
      const y = point.y;
      
      // Start node - Village (static)
      if (node.type === 'start') {
        return (
          <g key={node.id}>
            {/* Building shadow */}
            <ellipse
              cx={x + 3}
              cy={y + 18}
              rx="20"
              ry="8"
              fill="rgba(0,0,0,0.3)"
            />
            {/* Building base */}
            <ellipse
              cx={x}
              cy={y + 12}
              rx="18"
              ry="6"
              fill="url(#platformGradient)"
            />
            {/* Building walls */}
            <rect
              x={x - 12}
              y={y - 8}
              width="24"
              height="20"
              fill="url(#buildingGradient)"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
              rx="2"
            />
            {/* Roof */}
            <polygon
              points={`${x-15},${y-8} ${x},${y-18} ${x+15},${y-8}`}
              fill="url(#roofGradient)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
            />
            {/* Door */}
            <rect
              x={x - 3}
              y={y + 2}
              width="6"
              height="10"
              fill="#8b4513"
              rx="3"
            />
            {/* Windows */}
            <rect x={x - 8} y={y - 2} width="4" height="4" fill="#fbbf24" rx="1" />
            <rect x={x + 4} y={y - 2} width="4" height="4" fill="#fbbf24" rx="1" />
          </g>
        );
      }
      
      // End node - Castle (static)
      if (node.type === 'end') {
        return (
          <g key={node.id}>
            {/* Castle shadow */}
            <ellipse
              cx={x + 4}
              cy={y + 25}
              rx="30"
              ry="12"
              fill="rgba(0,0,0,0.4)"
            />
            {/* Castle base */}
            <ellipse
              cx={x}
              cy={y + 18}
              rx="25"
              ry="10"
              fill="url(#goldPlatformGradient)"
            />
            {/* Main castle */}
            <rect
              x={x - 20}
              y={y - 15}
              width="40"
              height="33"
              fill="url(#castleGradient)"
              stroke="rgba(255,215,0,0.5)"
              strokeWidth="2"
              rx="3"
            />
            {/* Towers */}
            <rect x={x - 25} y={y - 25} width="10" height="35" fill="url(#towerGradient)" rx="2" />
            <rect x={x + 15} y={y - 25} width="10" height="35" fill="url(#towerGradient)" rx="2" />
            <rect x={x - 5} y={y - 30} width="10" height="25" fill="url(#towerGradient)" rx="2" />
            
            {/* Flags */}
            <polygon points={`${x-20},${y-25} ${x-15},${y-30} ${x-20},${y-35} ${x-25},${y-30}`} fill="#dc2626" />
            <polygon points={`${x+20},${y-25} ${x+25},${y-30} ${x+20},${y-35} ${x+15},${y-30}`} fill="#dc2626" />
            
            {/* Castle gate */}
            <rect
              x={x - 6}
              y={y + 5}
              width="12"
              height="15"
              fill="#4b5563"
              rx="6"
            />
            
            {/* Victory glow */}
            <circle
              cx={x}
              cy={y}
              r="35"
              fill="rgba(255, 215, 0, 0.2)"
              className="animate-pulse"
            />
          </g>
        );
      }
      
      // Current door - Glowing portal (static position)
      if (node.status === 'current') {
        return (
          <g key={node.id}>
            {/* Energy rings */}
            <circle cx={x} cy={y} r="25" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.3" className="animate-ping" />
            <circle cx={x} cy={y} r="35" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.2" className="animate-ping" style={{animationDelay: '0.5s'}} />
            
            {/* Portal shadow */}
            <ellipse
              cx={x + 3}
              cy={y + 15}
              rx="15"
              ry="6"
              fill="rgba(0,0,0,0.4)"
            />
            
            {/* Portal base */}
            <ellipse
              cx={x}
              cy={y + 12}
              rx="12"
              ry="4"
              fill="url(#portalBaseGradient)"
            />
            
            {/* Portal frame */}
            <ellipse
              cx={x}
              cy={y}
              rx="18"
              ry="22"
              fill="none"
              stroke="url(#portalFrameGradient)"
              strokeWidth="4"
              className="animate-pulse"
            />
            
            {/* Portal energy */}
            <ellipse
              cx={x}
              cy={y}
              rx="14"
              ry="18"
              fill="url(#portalEnergyGradient)"
              opacity="0.7"
              className="animate-pulse"
            />
            
            {/* Door symbol */}
            <text
              x={x}
              y={y + 5}
              textAnchor="middle"
              className="text-lg font-bold fill-white animate-bounce"
              style={{ fontSize: '18px' }}
            >
              🚪
            </text>
          </g>
        );
      }
      
      // Completed doors - Stone monuments (static)
      if (node.status === 'completed') {
        const doorColor = node.color === 'green' ? '#22c55e' : 
                          node.color === 'yellow' ? '#eab308' : '#ef4444';
        const glowColor = node.color === 'green' ? 'rgba(34, 197, 94, 0.4)' : 
                          node.color === 'yellow' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        
        return (
          <g key={node.id}>
            {/* Monument shadow */}
            <ellipse
              cx={x + 2}
              cy={y + 12}
              rx="12"
              ry="5"
              fill="rgba(0,0,0,0.3)"
            />
            
            {/* Monument base */}
            <ellipse
              cx={x}
              cy={y + 10}
              rx="10"
              ry="3"
              fill="url(#monumentBaseGradient)"
            />
            
            {/* Monument pillar */}
            <rect
              x={x - 6}
              y={y - 10}
              width="12"
              height="20"
              fill="url(#monumentGradient)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
              rx="1"
            />
            
            {/* Success glow */}
            <circle
              cx={x}
              cy={y}
              r="15"
              fill={glowColor}
              className="animate-pulse"
            />
            
            {/* Door symbol */}
            <text
              x={x}
              y={y + 2}
              textAnchor="middle"
              className="text-sm font-bold fill-white"
              style={{ fontSize: '14px' }}
            >
              🚪
            </text>
            
            {/* Score crystal */}
            {node.score && (
              <g>
                <polygon
                  points={`${x-4},${y-15} ${x},${y-20} ${x+4},${y-15} ${x},${y-10}`}
                  fill={doorColor}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1"
                  className="animate-pulse"
                />
                <text
                  x={x}
                  y={y - 13}
                  textAnchor="middle"
                  className="text-xs fill-white font-bold"
                  style={{ fontSize: '8px' }}
                >
                  {Math.round(node.score)}
                </text>
              </g>
            )}
          </g>
        );
      }
      
      return null;
    });
  };

  return (
    <div className={`bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 rounded-xl p-4 border border-blue-800 h-full max-h-[800px] flex flex-col ${className}`}>
      <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-lg">
        🗺️ <span className="text-blue-200">Adventure Map</span>
      </h3>
      
      {/* Isometric Fantasy Map */}
      <div className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 rounded-lg p-4 mb-4 border border-blue-800 overflow-hidden flex-1 max-h-[650px]">
        {/* World Map Background */}
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <img
            src="/worldmap.jpg"
            alt="World Map"
            className="w-full h-full object-cover"
            onLoad={() => console.log('World map loaded successfully')}
            onError={(e) => {
              console.log('World map image failed to load, using fallback');
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        
        <svg 
          viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
          className="w-full h-full max-h-[600px] relative z-10" 
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gradients for isometric elements */}
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            
            <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            
            <linearGradient id="roofGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
            
            <linearGradient id="platformGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6b7280" />
              <stop offset="100%" stopColor="#374151" />
            </linearGradient>
            
            <linearGradient id="castleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            
            <linearGradient id="towerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            
            <linearGradient id="goldPlatformGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            
            <radialGradient id="portalEnergyGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.3" />
            </radialGradient>
            
            <linearGradient id="portalFrameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            
            <linearGradient id="portalBaseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            
            <linearGradient id="monumentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            
            <linearGradient id="monumentBaseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#374151" />
              <stop offset="100%" stopColor="#1f2937" />
            </linearGradient>
          </defs>
          
          {/* Fantasy world background */}
          <rect width="100%" height="100%" fill="url(#earthBackground)" />
          
          {/* Draw static terrain (never moves) */}
          {drawTerrain()}
          
          {/* Draw static path (never moves) */}
          {drawPath()}
          
          {/* Draw static buildings and doors (never move) */}
          {drawNodes()}
        </svg>
      </div>

      {/* Path Impact Display */}
      {pathImpact && (
        <div className="mb-4 text-center">
          <div className={`${pathImpact.color} font-bold text-lg animate-bounce`}>
            {pathImpact.text}
          </div>
        </div>
      )}

      {/* Progress Stats */}
      <div className="flex justify-center">
        <div className="bg-blue-900/50 rounded-lg p-4 text-center border border-blue-700">
          <div className="text-blue-200 font-bold text-2xl">{gamePath.currentPosition}</div>
          <div className="text-blue-300 text-sm">Doors Conquered</div>
        </div>
      </div>
    </div>
  );
};