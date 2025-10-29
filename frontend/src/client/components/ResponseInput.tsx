import { useState, useEffect, useCallback, useRef } from 'react';

interface ResponseInputProps {
  onSubmit: (response: string) => Promise<void>;
  disabled?: boolean;
  timeLeft?: number;
  maxLength?: number;
  placeholder?: string;
  submitted?: boolean;
  error?: string | null;
  className?: string;
  autoFocus?: boolean;
}

export const ResponseInput = ({
  onSubmit,
  disabled = false,
  timeLeft = 0,
  maxLength = 500,
  placeholder = "Describe your creative solution...",
  submitted = false,
  error = null,
  className = "",
  autoFocus = true
}: ResponseInputProps) => {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Character count thresholds for visual feedback
  const warningThreshold = Math.floor(maxLength * 0.8); // 80%
  const dangerThreshold = Math.floor(maxLength * 0.95); // 95%

  // Auto-focus textarea when component mounts or resets
  useEffect(() => {
    if (autoFocus && textareaRef.current && !submitted && !disabled) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, submitted, disabled]);

  // Reset state when submitted prop changes
  useEffect(() => {
    if (submitted) {
      setResponse('');
      setValidationError(null);
      setShowConfirmation(false);
      setHasInteracted(false);
      setSubmitAttempted(false);
    }
  }, [submitted]);

  // Validate response in real-time
  const validateResponse = useCallback((text: string) => {
    if (text.length === 0) {
      return "Response cannot be empty";
    }
    if (text.length > maxLength) {
      return `Response exceeds ${maxLength} character limit`;
    }
    if (text.trim().length < 10) {
      return "Response must be at least 10 characters long";
    }
    // Check for potentially inappropriate content patterns
    const inappropriatePatterns = [
      /(.)\1{10,}/i, // Repeated characters (spam)
      /^[^a-zA-Z]*$/,  // No letters at all
    ];
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(text)) {
        return "Please provide a meaningful response";
      }
    }
    
    return null;
  }, [maxLength]);

  // Handle text change with validation
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setResponse(newText);
    setHasInteracted(true);
    
    // Clear submit attempt flag when user starts typing again
    if (submitAttempted) {
      setSubmitAttempted(false);
    }
    
    // Real-time validation (only show errors after user has interacted)
    const error = validateResponse(newText);
    setValidationError(hasInteracted ? error : null);
  };

  // Handle submission with confirmation
  const handleSubmit = async () => {
    setSubmitAttempted(true);
    const trimmedResponse = response.trim();
    const error = validateResponse(trimmedResponse);
    
    if (error) {
      setValidationError(error);
      // Add shake animation to draw attention to error
      if (textareaRef.current) {
        textareaRef.current.classList.add('animate-shake');
        setTimeout(() => {
          textareaRef.current?.classList.remove('animate-shake');
        }, 500);
      }
      return;
    }

    // Show confirmation for long responses
    if (trimmedResponse.length > 200 && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await onSubmit(trimmedResponse);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
      setShowConfirmation(false);
    }
  };

  // Cancel confirmation
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  // Get character count styling with enhanced feedback
  const getCharacterCountStyle = () => {
    if (response.length >= dangerThreshold) {
      return 'text-red-600 font-semibold animate-pulse';
    }
    if (response.length >= warningThreshold) {
      return 'text-yellow-600 font-medium';
    }
    if (response.length > 0) {
      return 'text-blue-600';
    }
    return 'text-gray-500';
  };

  // Get progress bar styling
  const getProgressBarStyle = () => {
    const percentage = (response.length / maxLength) * 100;
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  // Check if submission is allowed
  const canSubmit = !disabled && 
                   !isSubmitting && 
                   !submitted && 
                   timeLeft > 0 && 
                   response.trim().length > 0 && 
                   !validationError;

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit with Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
    
    // Escape to cancel confirmation
    if (e.key === 'Escape' && showConfirmation) {
      e.preventDefault();
      handleCancelConfirmation();
    }
  };

  // Display error (validation or external)
  const displayError = validationError || error;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error Display */}
      {displayError && (
        <div 
          id="validation-error"
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fade-in"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span className="text-red-500" aria-hidden="true">⚠️</span>
            <span>{displayError}</span>
          </div>
        </div>
      )}

      {/* Success Message */}
      {submitted && (
        <div 
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span className="text-green-500" aria-hidden="true">✅</span>
            <span>Response submitted successfully!</span>
          </div>
        </div>
      )}

      {/* Text Input Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={response}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full h-32 px-4 py-3 border rounded-lg focus-enhanced resize-none transition-enhanced ${
            displayError 
              ? 'border-red-300 focus:ring-red-500 bg-red-50' 
              : submitted 
                ? 'border-green-300 focus:ring-green-500 bg-green-50'
                : timeLeft <= 10 && timeLeft > 0
                  ? 'border-orange-300 focus:ring-orange-500 animate-pulse-glow'
                  : 'border-gray-300 focus:ring-blue-500'
          }`}
          maxLength={maxLength}
          disabled={disabled || submitted || timeLeft === 0 || isSubmitting}
          rows={4}
          aria-describedby="char-count validation-error"
          aria-invalid={!!displayError}
        />
        
        {/* Keyboard shortcut hint */}
        {!submitted && !disabled && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
            {canSubmit ? 'Ctrl+Enter to submit' : ''}
          </div>
        )}
        
        {/* Character Count and Progress */}
        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center">
            <span id="char-count" className={`text-sm ${getCharacterCountStyle()}`}>
              {response.length}/{maxLength} characters
              {response.length >= warningThreshold && (
                <span className="ml-2 text-xs">
                  ({maxLength - response.length} remaining)
                </span>
              )}
            </span>
            
            {/* Time Warning */}
            {timeLeft <= 10 && timeLeft > 0 && (
              <span className="text-red-600 text-sm font-medium animate-pulse">
                ⏰ {timeLeft}s remaining
              </span>
            )}
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarStyle()}`}
              style={{ width: `${Math.min((response.length / maxLength) * 100, 100)}%` }}
            />
          </div>
          
          {/* Word count and reading time estimate */}
          {response.length > 0 && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {response.trim().split(/\s+/).filter(word => word.length > 0).length} words
              </span>
              <span>
                ~{Math.ceil(response.length / 5)} seconds to read
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-500 text-xl">💭</span>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-2">Confirm Your Response</h4>
              <p className="text-blue-700 text-sm mb-3">
                You've written a detailed response ({response.length} characters). 
                Are you ready to submit it?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Yes, Submit
                </button>
                <button
                  onClick={handleCancelConfirmation}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400 transition-colors"
                >
                  Keep Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-3 px-6 rounded-lg font-medium transition-enhanced ${
          canSubmit
            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5 active:scale-95'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        } ${timeLeft <= 10 && timeLeft > 0 && canSubmit ? 'animate-pulse-glow' : ''}`}
        aria-label={
          isSubmitting ? 'Submitting response' :
          submitted ? 'Response submitted successfully' :
          timeLeft === 0 ? 'Time expired' :
          showConfirmation ? 'Confirm submission above' :
          'Submit your response'
        }
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Submitting Response...
          </span>
        ) : submitted ? (
          <span className="flex items-center justify-center gap-2">
            <span>✅</span>
            Response Submitted
          </span>
        ) : timeLeft === 0 ? (
          <span className="flex items-center justify-center gap-2">
            <span>⏰</span>
            Time's Up!
          </span>
        ) : showConfirmation ? (
          "Confirm Above"
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span>📝</span>
            Submit Response
            {canSubmit && (
              <span className="text-xs opacity-75">(Ctrl+Enter)</span>
            )}
          </span>
        )}
      </button>

      {/* Helpful Tips */}
      {!submitted && !displayError && response.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-gray-400">💡</span>
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Tips for a great response:</p>
              <ul className="text-xs space-y-1 text-gray-500">
                <li>• Be creative and think outside the box</li>
                <li>• Explain your reasoning clearly</li>
                <li>• Consider both practical and humorous solutions</li>
                <li>• Aim for 50-200 characters for best results</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};