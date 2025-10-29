import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Report error to monitoring service
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state if resetKeys have changed
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (resetKey, idx) => prevProps.resetKeys?.[idx] !== resetKey
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  retryAfterDelay = (delay: number = 3000) => {
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  reportError = (error: Error, errorInfo: ErrorInfo) => {
    // Report to error tracking service (e.g., Sentry, LogRocket, etc.)
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Send to monitoring endpoint
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorReport),
    }).catch((reportingError) => {
      console.error('Failed to report error:', reportingError);
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.resetErrorBoundary}
          onRetryAfterDelay={() => this.retryAfterDelay()}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  onRetry: () => void;
  onRetryAfterDelay: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  onRetryAfterDelay,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      onRetry();
      setIsRetrying(false);
    }, 500);
  };

  const handleAutoRetry = () => {
    setIsRetrying(true);
    onRetryAfterDelay();
  };

  const copyErrorDetails = () => {
    const errorDetails = {
      errorId,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        alert('Error details copied to clipboard');
      })
      .catch(() => {
        console.error('Failed to copy error details');
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">😵</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Oops! Something went wrong
          </h1>
          <p className="text-gray-600">
            We encountered an unexpected error. Don't worry, we've been notified and are working on it.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-red-800">Error Details</h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
          </div>
          
          <p className="text-sm text-red-700 mb-2">
            Error ID: <code className="bg-red-100 px-1 rounded">{errorId}</code>
          </p>
          
          {showDetails && (
            <div className="mt-4 space-y-2">
              <div>
                <h4 className="text-xs font-medium text-red-800 mb-1">Message:</h4>
                <pre className="text-xs text-red-700 bg-red-100 p-2 rounded overflow-x-auto">
                  {error?.message || 'Unknown error'}
                </pre>
              </div>
              
              {error?.stack && (
                <div>
                  <h4 className="text-xs font-medium text-red-800 mb-1">Stack Trace:</h4>
                  <pre className="text-xs text-red-700 bg-red-100 p-2 rounded overflow-x-auto max-h-32">
                    {error.stack}
                  </pre>
                </div>
              )}
              
              <button
                onClick={copyErrorDetails}
                className="text-xs text-red-600 hover:text-red-800 underline"
              >
                Copy error details
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isRetrying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Retrying...
              </>
            ) : (
              'Try Again'
            )}
          </button>
          
          <button
            onClick={handleAutoRetry}
            disabled={isRetrying}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Auto Retry in 3s
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Refresh Page
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            If the problem persists, please{' '}
            <a
              href="mailto:support@dumdoors.com"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              contact support
            </a>{' '}
            with the error ID above.
          </p>
        </div>
      </div>
    </div>
  );
};

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Hook for error reporting
export const useErrorHandler = () => {
  const reportError = React.useCallback((error: Error, context?: string) => {
    console.error('Manual error report:', error, context);
    
    const errorReport = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorReport),
    }).catch((reportingError) => {
      console.error('Failed to report error:', reportingError);
    });
  }, []);

  return { reportError };
};