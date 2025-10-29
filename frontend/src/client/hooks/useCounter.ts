import { useCallback, useEffect, useState } from 'react';
import type { InitResponse, IncrementResponse, DecrementResponse } from '../../shared/types/api';

interface CounterState {
  count: number;
  username: string | null;
  loading: boolean;
}

export const useCounter = () => {
  const [state, setState] = useState<CounterState>({
    count: 0,
    username: null,
    loading: true,
  });
  const [postId, setPostId] = useState<string | null>(null);

  // fetch initial data
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        
        // Check if response is HTML (404 page) instead of JSON
        if (text.trim().startsWith('<!')) {
          throw new Error('API endpoint not available - using fallback');
        }
        
        const data: InitResponse = JSON.parse(text);
        if (data.type !== 'init') throw new Error('Unexpected response');
        setState({ count: data.count, username: data.username, loading: false });
        setPostId(data.postId);
      } catch (err) {
        console.error('Failed to init counter', err);
        // Fallback for game mode - set default values
        setState({ 
          count: 0, 
          username: 'Player', 
          loading: false 
        });
        setPostId('game-mode');
      }
    };
    void init();
  }, []);

  const update = useCallback(
    async (action: 'increment' | 'decrement') => {
      if (!postId) {
        console.error('No postId – cannot update counter');
        return;
      }
      
      // If in game mode (fallback), just update locally
      if (postId === 'game-mode') {
        setState((prev) => ({ 
          ...prev, 
          count: action === 'increment' ? prev.count + 1 : prev.count - 1 
        }));
        return;
      }
      
      try {
        const res = await fetch(`/api/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: IncrementResponse | DecrementResponse = await res.json();
        setState((prev) => ({ ...prev, count: data.count }));
      } catch (err) {
        console.error(`Failed to ${action}`, err);
        // Fallback to local update
        setState((prev) => ({ 
          ...prev, 
          count: action === 'increment' ? prev.count + 1 : prev.count - 1 
        }));
      }
    },
    [postId]
  );

  const increment = useCallback(() => update('increment'), [update]);
  const decrement = useCallback(() => update('decrement'), [update]);

  return {
    ...state,
    increment,
    decrement,
  } as const;
};
