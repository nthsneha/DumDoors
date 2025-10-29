import { useState, useCallback, useRef } from 'react';

export interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
  retryCount: number;
  lastRetryAt: Date | null;
}

export interface ErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error, context?: string) => void;
  onRetry?: (retryCount: number) => void;
  onMaxRetriesReached?: (error: Error) => void;
}

export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorId: '',
    retryCount: 0,
    lastRetryAt: null,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generateErrorId = useCallback(() => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const reportError = useCallback((error: Error, context?: string) => {
    const errorReport = {
      errorId: errorState.errorId || generateErrorId(),
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: errorState.retryCount,
    };

    // Send to error reporting service
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorReport),
    }).catch((reportingError) => {
      console.error('Failed to report error:', reportingError);
    });

    console.error('Error reported:', errorReport);
  }, [errorState.errorId, errorState.retryCount, generateErrorId]);

  const handleError = useCallback((error: Error, context?: string) => {
    const errorId = generateErrorId();
    
    setErrorState(prev => ({
      hasError: true,
      error,
      errorId,
      retryCount: prev.retryCount,
      lastRetryAt: prev.lastRetryAt,
    }));

    reportError(error, context);
    onError?.(error, context);
  }, [generateErrorId, reportError, onError]);

  const clearError = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setErrorState({
      hasError: false,
      error: null,
      errorId: '',
      retryCount: 0,
      lastRetryAt: null,
    });
  }, []);

  const retry = useCallback((operation?: () => void | Promise<void>) => {
    if (errorState.retryCount >= maxRetries) {
      onMaxRetriesReached?.(errorState.error!);
      return;
    }

    const newRetryCount = errorState.retryCount + 1;
    
    setErrorState(prev => ({
      ...prev,
      retryCount: newRetryCount,
      lastRetryAt: new Date(),
    }));

    onRetry?.(newRetryCount);

    if (operation) {
      // Execute the retry operation after delay
      retryTimeoutRef.current = setTimeout(async () => {
        try {
          await operation();
          clearError();
        } catch (error) {
          handleError(error as Error, 'retry_operation');
        }
      }, retryDelay * newRetryCount); // Exponential backoff
    } else {
      // Just clear the error state
      setTimeout(clearError, retryDelay);
    }
  }, [errorState.retryCount, errorState.error, maxRetries, retryDelay, onRetry, onMaxRetriesReached, clearError, handleError]);

  const canRetry = errorState.retryCount < maxRetries;

  return {
    errorState,
    handleError,
    clearError,
    retry,
    canRetry,
    reportError,
  };
};

// Hook for async operations with error handling
export const useAsyncOperation = <T = any>(options: ErrorHandlerOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const errorHandler = useErrorHandler(options);

  const execute = useCallback(async (operation: () => Promise<T>, context?: string) => {
    setIsLoading(true);
    errorHandler.clearError();

    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (error) {
      errorHandler.handleError(error as Error, context);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [errorHandler]);

  const retryOperation = useCallback((operation: () => Promise<T>, context?: string) => {
    errorHandler.retry(() => execute(operation, context));
  }, [errorHandler, execute]);

  return {
    isLoading,
    data,
    execute,
    retryOperation,
    ...errorHandler,
  };
};

// Hook for network requests with retry logic
export const useNetworkRequest = (options: ErrorHandlerOptions = {}) => {
  const asyncOp = useAsyncOperation(options);

  const request = useCallback(async (
    url: string,
    requestOptions: RequestInit = {},
    context?: string
  ) => {
    return asyncOp.execute(async () => {
      const response = await fetch(url, {
        ...requestOptions,
        headers: {
          'Content-Type': 'application/json',
          ...requestOptions.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
        (error as any).response = errorData;
        throw error;
      }

      return response.json();
    }, context || `${requestOptions.method || 'GET'} ${url}`);
  }, [asyncOp]);

  const get = useCallback((url: string, context?: string) => {
    return request(url, { method: 'GET' }, context);
  }, [request]);

  const post = useCallback((url: string, data?: any, context?: string) => {
    return request(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, context);
  }, [request]);

  const put = useCallback((url: string, data?: any, context?: string) => {
    return request(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, context);
  }, [request]);

  const del = useCallback((url: string, context?: string) => {
    return request(url, { method: 'DELETE' }, context);
  }, [request]);

  return {
    request,
    get,
    post,
    put,
    delete: del,
    ...asyncOp,
  };
};

// Hook for WebSocket connections with error handling
export const useWebSocketErrorHandler = (options: ErrorHandlerOptions = {}) => {
  const errorHandler = useErrorHandler(options);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const handleConnectionError = useCallback((error: Error | Event, context?: string) => {
    setConnectionState('error');
    
    let errorObj: Error;
    if (error instanceof Error) {
      errorObj = error;
    } else {
      errorObj = new Error('WebSocket connection error');
      (errorObj as any).event = error;
    }
    
    errorHandler.handleError(errorObj, context || 'websocket_connection');
  }, [errorHandler]);

  const handleConnectionSuccess = useCallback(() => {
    setConnectionState('connected');
    errorHandler.clearError();
  }, [errorHandler]);

  const handleConnectionClose = useCallback((event: CloseEvent) => {
    setConnectionState('disconnected');
    
    // Only treat as error if it wasn't a normal closure
    if (event.code !== 1000) {
      const error = new Error(`WebSocket closed unexpectedly: ${event.reason || 'Unknown reason'}`);
      (error as any).code = event.code;
      (error as any).reason = event.reason;
      errorHandler.handleError(error, 'websocket_close');
    }
  }, [errorHandler]);

  return {
    connectionState,
    setConnectionState,
    handleConnectionError,
    handleConnectionSuccess,
    handleConnectionClose,
    ...errorHandler,
  };
};