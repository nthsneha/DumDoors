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
  const mapHeight = 500; // Increased height for vertical expansion
  
  // Only show nodes that have been revealed (completed + current + next if current exists)
  const getVisibleNodes = () => {
    const visibleNodes = [];
    
    for (let i = 0; i < gamePath.nodes.length; i++) {
      const node = gamePath.nodes[i];
      if (!node) continue;
      
      // Always show start
      if (node.type === 'start') {
        visibleNodes.push(node);
        continue;
      }
      
      // Show completed doors
      if (node.status === 'completed') {
        visibleNodes.push(node);
        continue;
      }
      
      // Show current door
      if (node.status === 'current') {
        visibleNodes.push(node);
        continue;
      }
      
      // Only show end if we're at the final door
      if (node.type === 'end' && gamePath.currentPosition >= gamePath.totalLength - 1) {
        visibleNodes.push(node);
        continue;
      }
      
      // Don't show future doors or end until we're close
      break;
    }
    
    return visibleNodes;
  };

  const visibleNodes = getVisibleNodes();
  
  // Generate isometric path positions for visible nodes
  const generateIsometricPath = () => {
    const pathPoints = [];
    const nodeCount = visibleNodes.length;
    
    for (let i = 0; i < nodeCount; i++) {
      const progress = i / Math.max(1, nodeCount - 1);
      
      // Isometric projection: create depth and perspective
      const baseX = 20 + progress * 60; // Horizontal progression
      const baseZ = Math.sin(progress * Math.PI * 2) * 20; // Depth variation
      const baseY = 50 + Math.cos(progress * Math.PI * 1.5) * 15; // Vertical variation
      
      // Convert to isometric 2D coordinates
      const isoX = baseX + baseZ * 0.5; // X affected by depth
      const isoY = baseY - baseZ * 0.3; // Y affected by depth (isometric angle)
      
      // Add some randomness for organic feel
      const randomX = (Math.random() - 0.5) * 8;
      const randomY = (Math.random() - 0.5) * 8;
      
      pathPoints.push({
        x: Math.max(10, Math.min(90, isoX + randomX)),
        y: Math.max(15, Math.min(85, isoY + randomY)),
        z: baseZ, // Keep depth for layering
        index: i,
        node: visibleNodes[i]
      });
    }
    
    return pathPoints;
  };

  const pathPoints = generateIsometricPath();
  
  // Draw earth-like terrain features
  const drawTerrain = () => {
    const features: React.ReactElement[] = [];
    
    // Static terrain features that look earth-like
    const terrainFeatures = [
      // Mountains
      { type: 'mountain', x: 15, y: 20, size: 40, color: '#6b7280' },
      { type: 'mountain', x: 75, y: 15, size: 35, color: '#64748b' },
      { type: 'mountain', x: 85, y: 70, size: 30, color: '#6b7280' },
      
      // Forests
      { type: 'forest', x: 25, y: 60, size: 50, color: '#22c55e' },
      { type: 'forest', x: 60, y: 80, size: 45, color: '#16a34a' },
      { type: 'forest', x: 10, y: 85, size: 35, color: '#15803d' },
      
      // Lakes/Water
      { type: 'water', x: 45, y: 25, size: 30, color: '#3b82f6' },
      { type: 'water', x: 70, y: 45, size: 25, color: '#2563eb' },
      
      // Plains/Grasslands
      { type: 'plains', x: 35, y: 40, size: 60, color: '#84cc16' },
      { type: 'plains', x: 55, y: 65, size: 55, color: '#65a30d' },
      { type: 'plains', x: 20, y: 75, size: 40, color: '#84cc16' },
      
      // Desert areas
      { type: 'desert', x: 80, y: 30, size: 35, color: '#f59e0b' },
      { type: 'desert', x: 90, y: 50, size: 25, color: '#d97706' },
    ];
    
    terrainFeatures.forEach((feature, index) => {
      const x = (feature.x / 100) * mapWidth;
      const y = (feature.y / 100) * mapHeight;
      const size = (feature.size / 100) * Math.min(mapWidth, mapHeight);
      
      features.push(
        <g key={`terrain-${index}`}>
          <circle
            cx={x}
            cy={y}
            r={size / 2}
            fill={feature.color}
            opacity="0.4"
            className="transition-all duration-300"
          />
          {/* Add texture overlay */}
          <circle
            cx={x}
            cy={y}
            r={size / 2}
            fill="url(#terrainTexture)"
            opacity="0.2"
          />
        </g>
      );
    });
    
    return features;
  };

  // Draw the path with isometric depth
  const drawIsometricPath = () => {
    if (pathPoints.length < 2) return null;
    
    const pathElements = [];
    
    // Draw path segments
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const current = pathPoints[i];
      const next = pathPoints[i + 1];
      
      if (!current || !next) continue;
      
      const x1 = (current.x / 100) * mapWidth;
      const y1 = (current.y / 100) * mapHeight;
      const x2 = (next.x / 100) * mapWidth;
      const y2 = (next.y / 100) * mapHeight;
      
      // Path segment with depth effect
      pathElements.push(
        <g key={`path-${i}`}>
          {/* Shadow/depth layer */}
          <line
            x1={x1 + 2}
            y1={y1 + 2}
            x2={x2 + 2}
            y2={y2 + 2}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Main path */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#pathGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            className="animate-path-glow"
          />
          {/* Highlight */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    }
    
    return pathElements;
  };

  // Draw isometric nodes with depth
  const drawIsometricNodes = () => {
    return pathPoints.map((point) => {
      const node = point.node;
      if (!node) return null;
      
      const x = (point.x / 100) * mapWidth;
      const y = (point.y / 100) * mapHeight;
      const depth = point.z;
      
      // Shadow offset based on depth
      const shadowOffset = Math.abs(depth) * 0.1 + 2;
      
      // Start node - Village
      if (node.type === 'start') {
        return (
          <g key={node.id} className="animate-float">
            {/* Shadow */}
            <ellipse
              cx={x + shadowOffset}
              cy={y + shadowOffset + 15}
              rx="20"
              ry="8"
              fill="rgba(0,0,0,0.3)"
            />
            {/* Base platform */}
            <ellipse
              cx={x}
              cy={y + 12}
              rx="18"
              ry="6"
              fill="url(#platformGradient)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
            />
            {/* Building structure */}
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
            <text
              x={x}
              y={y - 25}
              textAnchor="middle"
              className="text-xs fill-green-300 font-bold animate-pulse"
              style={{ fontSize: '10px' }}
            >
              START
            </text>
          </g>
        );
      }
      
      // End node - Trophy/Castle (only show when close)
      if (node.type === 'end') {
        return (
          <g key={node.id} className="animate-bounce-slow">
            {/* Shadow */}
            <ellipse
              cx={x + shadowOffset}
              cy={y + shadowOffset + 20}
              rx="25"
              ry="10"
              fill="rgba(0,0,0,0.4)"
            />
            {/* Base platform */}
            <ellipse
              cx={x}
              cy={y + 15}
              rx="22"
              ry="8"
              fill="url(#goldPlatformGradient)"
              stroke="rgba(255,215,0,0.6)"
              strokeWidth="2"
            />
            {/* Castle structure */}
            <rect
              x={x - 15}
              y={y - 15}
              width="30"
              height="30"
              fill="url(#castleGradient)"
              stroke="rgba(255,215,0,0.5)"
              strokeWidth="2"
              rx="3"
            />
            {/* Towers */}
            <rect x={x - 18} y={y - 20} width="8" height="25" fill="url(#towerGradient)" rx="1" />
            <rect x={x + 10} y={y - 20} width="8" height="25" fill="url(#towerGradient)" rx="1" />
            {/* Trophy */}
            <text
              x={x}
              y={y + 5}
              textAnchor="middle"
              className="text-2xl font-bold fill-yellow-300"
              style={{ fontSize: '24px' }}
            >
              🏆
            </text>
            <text
              x={x}
              y={y - 30}
              textAnchor="middle"
              className="text-xs fill-yellow-300 font-bold animate-pulse"
              style={{ fontSize: '10px' }}
            >
              VICTORY!
            </text>
          </g>
        );
      }
      
      // Current door - Glowing portal
      if (node.status === 'current') {
        return (
          <g key={node.id}>
            {/* Pulsing energy rings */}
            <circle cx={x} cy={y} r="25" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.3" className="animate-ping" />
            <circle cx={x} cy={y} r="35" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.2" className="animate-ping" style={{animationDelay: '0.5s'}} />
            
            {/* Shadow */}
            <ellipse
              cx={x + shadowOffset}
              cy={y + shadowOffset + 12}
              rx="15"
              ry="6"
              fill="rgba(0,0,0,0.4)"
            />
            
            {/* Portal base */}
            <ellipse
              cx={x}
              cy={y + 10}
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
            
            <text
              x={x}
              y={y - 30}
              textAnchor="middle"
              className="text-xs fill-blue-300 font-bold animate-bounce"
              style={{ fontSize: '9px' }}
            >
              CURRENT
            </text>
          </g>
        );
      }
      
      // Completed doors - Monuments
      if (node.status === 'completed') {
        const doorColor = node.color === 'green' ? '#22c55e' : 
                          node.color === 'yellow' ? '#eab308' : '#ef4444';
        const glowColor = node.color === 'green' ? 'rgba(34, 197, 94, 0.4)' : 
                          node.color === 'yellow' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        
        return (
          <g key={node.id}>
            {/* Shadow */}
            <ellipse
              cx={x + shadowOffset}
              cy={y + shadowOffset + 10}
              rx="12"
              ry="5"
              fill="rgba(0,0,0,0.3)"
            />
            
            {/* Monument base */}
            <ellipse
              cx={x}
              cy={y + 8}
              rx="10"
              ry="3"
              fill="url(#monumentBaseGradient)"
            />
            
            {/* Monument pillar */}
            <rect
              x={x - 6}
              y={y - 10}
              width="12"
              height="18"
              fill="url(#monumentGradient)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
              rx="1"
            />
            
            {/* Glow effect */}
            <circle
              cx={x}
              cy={y}
              r="15"
              fill={glowColor}
              className="animate-pulse"
            />
            
            {/* Door symbol on monument */}
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

  return (
    <div className={`bg-gradient-to-br from-green-900/20 via-blue-900/30 to-brown-900/20 backdrop-blur-lg rounded-xl p-4 border border-green-600/30 h-full ${className}`}>
      <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-lg">
        🌍 <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">World Map</span>
      </h3>
      
      {/* Earth-like SVG Map */}
      <div className="relative bg-gradient-to-br from-green-950/40 via-blue-950/30 to-amber-950/20 rounded-lg p-4 mb-4 border border-green-500/20 overflow-hidden flex-1">
        {/* Earth-like background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-green-800/30 via-blue-800/20 to-amber-800/30"></div>
          {/* Cloud-like patterns */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white/10 rounded-full"
              style={{
                left: `${Math.random() * 90}%`,
                top: `${Math.random() * 90}%`,
                width: `${20 + Math.random() * 40}px`,
                height: `${10 + Math.random() * 20}px`,
                animationDelay: `${Math.random() * 10}s`,
              }}
            />
          ))}
        </div>
        
        <svg width={mapWidth} height={mapHeight} className="w-full h-auto relative z-10">
          <defs>
            {/* Enhanced gradients for isometric elements */}
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
            
            {/* Earth-like texture pattern */}
            <pattern id="terrainTexture" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1" fill="rgba(255,255,255,0.1)" />
              <circle cx="15" cy="10" r="0.5" fill="rgba(255,255,255,0.05)" />
              <circle cx="10" cy="15" r="0.8" fill="rgba(255,255,255,0.08)" />
            </pattern>
            
            {/* Earth background gradient */}
            <radialGradient id="earthBackground" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.1" />
              <stop offset="30%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="60%" stopColor="#84cc16" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.3" />
            </radialGradient>
          </defs>
          
          {/* Earth background */}
          <rect width="100%" height="100%" fill="url(#earthBackground)" />
          
          {/* Draw terrain */}
          {drawTerrain()}
          
          {/* Draw path */}
          {drawIsometricPath()}
          
          {/* Draw nodes */}
          {drawIsometricNodes()}
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

      {/* Stats */}
      <div className="flex justify-center">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 text-center border border-cyan-500/20">
          <div className="text-cyan-400 font-bold text-2xl">{gamePath.currentPosition}</div>
          <div className="text-gray-300 text-sm">Doors Passed</div>
        </div>
      </div>
    </div>
  );
};