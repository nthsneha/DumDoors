import type { ConnectionStatus } from '../hooks/useGameSession';

interface ConnectionStatusProps {
  status: ConnectionStatus;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'unknown';
  reconnectAttempts?: number;
  lastError?: string | null;
  lastHeartbeat?: Date | null;
  showDetails?: boolean;
}

export const ConnectionStatus = ({ 
  status, 
  connectionQuality = 'unknown',
  reconnectAttempts = 0, 
  lastError,
  lastHeartbeat,
  showDetails = false
}: ConnectionStatusProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        const qualityIcon = connectionQuality === 'excellent' ? '🟢' : 
                           connectionQuality === 'good' ? '🟡' : 
                           connectionQuality === 'poor' ? '🟠' : '🟢';
        return {
          icon: qualityIcon,
          text: showDetails ? `Connected (${connectionQuality})` : 'Connected',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'connecting':
        return {
          icon: '🟡',
          text: 'Connecting...',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
      case 'reconnecting':
        return {
          icon: '🔄',
          text: `Reconnecting... (${reconnectAttempts}/5)`,
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'disconnected':
        return {
          icon: '🔴',
          text: 'Disconnected',
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
      case 'error':
        return {
          icon: '❌',
          text: 'Connection Error',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          icon: '⚪',
          text: 'Unknown',
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const getLastHeartbeatText = () => {
    if (!lastHeartbeat) return null;
    
    const now = new Date();
    const diff = now.getTime() - lastHeartbeat.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return `${seconds}s ago`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    } else {
      return `${Math.floor(seconds / 3600)}h ago`;
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${config.className}`}>
      <span className={status === 'reconnecting' ? 'animate-spin' : ''}>{config.icon}</span>
      <span>{config.text}</span>
      
      {showDetails && status === 'connected' && lastHeartbeat && (
        <span className="text-xs opacity-75">
          {getLastHeartbeatText()}
        </span>
      )}
      
      {lastError && status === 'error' && (
        <span className="text-xs opacity-75" title={lastError}>
          ⚠️
        </span>
      )}
      
      {showDetails && status === 'reconnecting' && (
        <span className="text-xs opacity-75">
          Attempt {reconnectAttempts}
        </span>
      )}
    </div>
  );
};