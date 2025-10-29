import React, { useState, useRef, useEffect } from 'react';

interface VoiceResponseInputProps {
  onSubmit: (response: string) => void;
  timeLeft: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const VoiceResponseInput: React.FC<VoiceResponseInputProps> = ({
  onSubmit,
  timeLeft,
  maxLength = 500,
  placeholder = "Describe what you would do...",
  disabled = false,
  autoFocus = false
}) => {
  const [response, setResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check for speech recognition support
  useEffect(() => {
    const checkSpeechSupport = async () => {
      // Check if we're in a secure context (HTTPS or localhost)
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      
      // Check for speech recognition API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      // Check for media devices
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      
      // Try to check microphone availability
      let hasMicrophone = false;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        hasMicrophone = devices.some(device => device.kind === 'audioinput');
      } catch (e) {
        console.log('Could not enumerate devices:', e);
      }
      
      // Log debug info
      console.log('Speech Recognition Debug:', {
        isSecureContext,
        hasSpeechRecognition: !!SpeechRecognition,
        hasMediaDevices,
        hasMicrophone,
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        browser: getBrowserInfo()
      });
      
      setSpeechSupported(!!SpeechRecognition && isSecureContext && hasMediaDevices);
    };
    
    checkSpeechSupport();
  }, []);

  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  };

  // Auto-focus textarea
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [response]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (response.trim() && !disabled) {
      onSubmit(response.trim());
      setResponse('');
    }
  };

  const handleVoiceInput = async () => {
    if (!speechSupported) {
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      if (!isSecureContext) {
        alert('Speech recognition requires HTTPS. Please use a secure connection.');
      } else {
        alert('Speech recognition is not supported in your browser. Try Chrome, Edge, or Safari.');
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
    } catch (permissionError) {
      console.error('Microphone permission denied:', permissionError);
      alert('Microphone permission is required for voice input. Please allow microphone access and try again.');
      return;
    }

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setResponse(prev => {
          const newText = prev + (prev ? ' ' : '') + finalTranscript;
          return newText.slice(0, maxLength);
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      // Provide user-friendly error messages
      switch (event.error) {
        case 'not-allowed':
          alert('Microphone access was denied. Please allow microphone permissions and try again.');
          break;
        case 'no-speech':
          console.log('No speech detected, stopping...');
          break;
        case 'audio-capture':
          alert('No microphone found. Please check your microphone connection.');
          break;
        case 'network':
          alert('Network error occurred. Please check your internet connection.');
          break;
        default:
          console.log('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (startError) {
      console.error('Failed to start speech recognition:', startError);
      setIsListening(false);
      alert('Failed to start voice recognition. Please try again.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeLeft <= 10) return 'text-red-400';
    if (timeLeft <= 30) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 relative z-50" style={{ position: 'relative', zIndex: 50 }}>
      {/* Timer */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-300">
          Character count: {response.length}/{maxLength}
        </div>
        <div className={`text-lg font-mono font-bold ${getTimeColor()}`}>
          ⏱️ {formatTime(timeLeft)}
        </div>
      </div>

      {/* Input Area */}
      <div className="relative z-50" style={{ position: 'relative', zIndex: 50 }}>
        <textarea
          ref={textareaRef}
          value={response}
          onChange={(e) => setResponse(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          disabled={disabled || timeLeft === 0}
          className="w-full min-h-[120px] max-h-[300px] p-4 bg-white/20 border-2 border-white/40 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-4 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            fontSize: '16px', 
            pointerEvents: 'auto', 
            position: 'relative', 
            zIndex: 9999,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            cursor: 'text'
          }}
        />
        
        {/* Voice Input Button */}
        {speechSupported && (
          <button
            type="button"
            onClick={handleVoiceInput}
            disabled={disabled || timeLeft === 0}
            className={`absolute bottom-4 right-4 p-3 rounded-full transition-all duration-200 ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isListening ? 'Stop recording' : 'Start voice input'}
          >
            {isListening ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a2 2 0 114 0v4a2 2 0 11-4 0V7z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Voice Status */}
      {isListening && (
        <div className="flex items-center gap-2 text-red-400 text-sm animate-pulse">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
          Listening... Speak your response
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!response.trim() || disabled || timeLeft === 0}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
      >
        {timeLeft === 0 ? 'Time\'s Up!' : 'Submit Response'}
      </button>

      {/* Debug Info */}
      <div className="text-xs text-gray-400 text-center space-y-1">
        <div>Press Ctrl+Enter to submit • {speechSupported ? 'Click microphone for voice input' : 'Voice input not supported'}</div>
        <button 
          type="button" 
          onClick={() => {
            console.log('Test button clicked - textarea should be clickable');
            if (textareaRef.current) {
              textareaRef.current.focus();
              console.log('Focused textarea');
            }
          }}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Test Focus
        </button>
      </div>
    </form>
  );
};