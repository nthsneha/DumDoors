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
      
      // Check for speech recognition API with Firefox compatibility
      const SpeechRecognition = (window as any).SpeechRecognition || 
                               (window as any).webkitSpeechRecognition || 
                               (window as any).mozSpeechRecognition ||
                               (window as any).msSpeechRecognition;
      
      // Check for media devices
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      
      // Try to check microphone availability
      let hasMicrophone = false;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        hasMicrophone = devices.some(device => device.kind === 'audioinput');
      } catch (e) {
        console.log('Could not enumerate devices:', e);
        hasMicrophone = true; // Assume microphone exists if we can't check
      }
      
      const browserInfo = getBrowserInfo();
      
      // Firefox specific handling
      let speechSupported = false;
      if (browserInfo === 'Firefox') {
        // Firefox requires media.webspeech.recognition.enable = true in about:config
        // We'll enable the button but show a helpful message
        speechSupported = isSecureContext && hasMediaDevices;
      } else {
        speechSupported = !!SpeechRecognition && isSecureContext && hasMediaDevices;
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
        browser: browserInfo,
        speechSupported
      });
      
      setSpeechSupported(speechSupported);
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

  const getVoiceInputStatus = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition || 
                             (window as any).mozSpeechRecognition ||
                             (window as any).msSpeechRecognition;
    
    if (SpeechRecognition) {
      return 'Click microphone for voice input';
    } else if (getBrowserInfo() === 'Firefox') {
      return 'Voice input available (needs Firefox config)';
    } else {
      return 'Voice input not supported in this browser';
    }
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
    const browserInfo = getBrowserInfo();
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition || 
                             (window as any).mozSpeechRecognition ||
                             (window as any).msSpeechRecognition;

    // Firefox specific handling
    if (browserInfo === 'Firefox' && !SpeechRecognition) {
      alert('Firefox requires enabling speech recognition:\n\n1. Type "about:config" in the address bar\n2. Search for "media.webspeech.recognition.enable"\n3. Set it to "true"\n4. Restart Firefox\n\nAlternatively, use Chrome or Edge for better speech recognition support.');
      return;
    }

    if (!SpeechRecognition) {
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      if (!isSecureContext) {
        alert('Speech recognition requires HTTPS. Please use a secure connection.');
      } else {
        alert('Speech recognition is not supported in your browser. Try Chrome, Edge, or Safari.');
      }
      return;
    }
    
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
      
      // Firefox specific settings
      if (browserInfo === 'Firefox') {
        recognition.continuous = false; // Firefox works better with single recognition
        recognition.interimResults = false;
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

      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
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

      {/* Input Area with External Mic Button */}
      <div className="flex gap-3 items-start">
        <div className="flex-1 relative z-50" style={{ position: 'relative', zIndex: 50 }}>
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
        </div>
        
        {/* Voice Input Button - Outside text area */}
        {speechSupported && (
          <button
            type="button"
            onClick={handleVoiceInput}
            disabled={disabled || timeLeft === 0}
            className={`flex-shrink-0 p-4 rounded-full transition-all duration-300 transform ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110 shadow-red-500/50' 
                : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 shadow-blue-500/30'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
            title={isListening ? 'Click to stop recording' : 'Click to start voice input'}
            style={{ minHeight: '56px', minWidth: '56px' }}
          >
            {isListening ? (
              // Stop/Pause Icon
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              // Microphone Icon
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
                <path d="M12 18v4"/>
                <path d="M8 22h8"/>
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
        <div>Press Ctrl+Enter to submit • {getVoiceInputStatus()}</div>
        {getBrowserInfo() === 'Firefox' && !speechSupported && (
          <div className="text-yellow-400">
            Firefox users: Enable speech recognition in about:config → media.webspeech.recognition.enable
          </div>
        )}
      </div>
    </form>
  );
};