import { useState, useEffect } from 'react';
import { useCounter } from './hooks/useCounter';
import { useBackgroundMusic } from './hooks/useBackgroundMusic';
import { useSoundEffects } from './hooks/useSoundEffects';
import { Leaderboard, GameResults } from './components';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameMinimap } from './components/GameMinimap';
import { VoiceResponseInput } from './components/VoiceResponseInput';
import { useErrorHandler } from './hooks/useErrorHandler';
import { scenarioService } from './services/scenarioService';
import { scoringService, type ScoreResponse } from './services/scoringService';
import { geminiService, type ScenarioAnalysis } from './services/geminiService';
import { dumStonesService } from './services/dumStonesService';
import { DumStoneReportCard } from './components/DumStoneReportCard';

import { CONFIG } from './constants/config';
import type { GameResults as GameResultsType } from '../shared/types/api';

type GameState = 'login' | 'menu' | 'playing' | 'leaderboard' | 'results' | 'dumstones';

interface GameScenario {
  id: string;
  content: string;
  reasoning: string;
  difficulty: number;
}

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

export const App = () => {
  const { username } = useCounter();
  const { isMuted, toggleMute } = useBackgroundMusic();
  const { isSoundEnabled, isLoaded: soundsLoaded, playScoreSound, toggleSoundEffects } = useSoundEffects();
  const { handleError, errorState, clearError } = useErrorHandler({
    maxRetries: 3,
    retryDelay: 2000,
    onError: (error, context) => {
      console.error('App error:', error, context);
    },
  });
  const [gameState, setGameState] = useState<GameState>('login');
  const [currentScenario, setCurrentScenario] = useState<GameScenario | null>(null);
  const [gamePath, setGamePath] = useState<GamePath>({
    nodes: [
      { id: 'start', position: 0, type: 'start', status: 'completed' },
      { id: 'end', position: CONFIG.GAME.DEFAULT_PATH_LENGTH, type: 'end', status: 'future' },
    ],
    totalLength: CONFIG.GAME.DEFAULT_PATH_LENGTH,
    currentPosition: 0,
  });
  const [doorColor, setDoorColor] = useState<'neutral' | 'red' | 'yellow' | 'green'>('neutral');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [totalGameTime, setTotalGameTime] = useState<number>(0);
  const [scenarioStartTime, setScenarioStartTime] = useState<number | null>(null);
  const [gameResults, setGameResults] = useState<GameResultsType | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<ScoreResponse | null>(null);
  const [playerScores, setPlayerScores] = useState<number[]>([]);
  const [showOutcome, setShowOutcome] = useState(false);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [showDoorAnimation, setShowDoorAnimation] = useState(false);
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [gameResponses, setGameResponses] = useState<Array<{ scenario: string, response: string, score: number }>>([]);
  const [dumStoneReport, setDumStoneReport] = useState<any>(null);
  const [hasPlayedBefore, setHasPlayedBefore] = useState<boolean>(false);


  // Timer for total game time
  useEffect(() => {
    if (gameState === 'playing' && gameStartTime && !isSubmitting) {
      const timer = setInterval(() => {
        setTotalGameTime(Math.floor((Date.now() - gameStartTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState, gameStartTime, isSubmitting]);

  // Initialize first scenario when game starts
  useEffect(() => {
    if (gameState === 'playing' && !currentScenario) {
      initializeGame();
    }
  }, [gameState, currentScenario]);

  // Check if user has played before (for DumStone availability)
  useEffect(() => {
    const checkUserPlayHistory = async () => {
      try {
        const response = await fetch('/api/user/has-played');
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            setHasPlayedBefore(data.hasPlayed);
            console.log('🃏 [DEBUG] User has played before:', data.hasPlayed);
          }
        }
      } catch (error) {
        console.error('Error checking user play history:', error);
      }
    };

    checkUserPlayHistory();
  }, []);

  const initializeGame = async () => {
    try {
      console.log('🎮 [GAME] Initializing game, getting first scenario...');
      
      // Set game start time
      setGameStartTime(Date.now());
      setTotalGameTime(0);
      
      // Get first scenario from hardcoded data
      const scenarioData = scenarioService.getRandomScenario();
      console.log('✅ [GAME] Got scenario data:', {
        scenarioLength: scenarioData.scenario.length,
        reasoningLength: scenarioData.reasoning.length,
        preview: scenarioData.scenario.substring(0, 50) + '...'
      });

      const firstScenario: GameScenario = {
        id: `scenario_${Date.now()}`,
        content: scenarioData.scenario,
        reasoning: scenarioData.reasoning,
        difficulty: 1,
      };

      setCurrentScenario(firstScenario);
      setScenarioStartTime(Date.now()); // Track when this scenario started
      console.log('✅ [GAME] Game initialized successfully');
    } catch (error) {
      console.error('❌ [GAME] Failed to initialize game:', error);
      handleError(error as Error, 'initialize_game');
    }
  };

  const handleLogin = () => {
    setGameState('menu');
    // Enable audio context on first user interaction
    if (soundsLoaded) {
      console.log('🔊 Enabling audio context on user interaction');
    }
  };

  const handleStartGame = () => {
    setGameState('playing');
    setDoorColor('neutral');
    setCurrentScenario(null); // Will be set by useEffect
    setGameStartTime(null); // Will be set in initializeGame
    setTotalGameTime(0);
  };

  const handleViewLeaderboard = () => {
    setGameState('leaderboard');
  };

  const handleViewDumStones = async () => {
    console.log('🃏 [DEBUG] handleViewDumStones called');
    
    try {
      setDumStoneReport('generating'); // Show loading state
      setGameState('dumstones');

      let responsesToUse = gameResponses;

      // If no current game responses, try to fetch from server
      if (responsesToUse.length === 0) {
        console.log('🃏 [DEBUG] No current game responses, fetching from server...');
        const response = await fetch('/api/user/responses');
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.responses) {
            responsesToUse = data.responses;
            console.log('🃏 [DEBUG] Fetched responses from server:', responsesToUse.length);
          }
        }
      }

      if (responsesToUse.length === 0) {
        console.log('🃏 [DEBUG] No responses available for DumStone generation');
        setDumStoneReport('error');
        return;
      }

      console.log('🃏 [DEBUG] Generating report with responses:', responsesToUse.length);
      const report = await dumStonesService.generateReport(responsesToUse);
      console.log('🃏 [DEBUG] Report generated:', report);
      setDumStoneReport(report);
    } catch (error) {
      console.error('Failed to generate Dum-Stones report:', error);
      setDumStoneReport('error');
    }
  };

  const handleCloseDumStones = () => {
    setGameState('menu');
    setDumStoneReport(null);
  };

  const handleBackToMenu = () => {
    setGameState('menu');
    setGameResults(null);
    setCurrentScenario(null);
    setPlayerScores([]);
    setCurrentAnalysis(null);
    setDoorColor('neutral');
    setWaitingForNext(false);
    setShowOutcome(false);
    setDumStoneReport(null);
    setGameStartTime(null);
    setTotalGameTime(0);
    setScenarioStartTime(null);
    setGamePath({
      nodes: [
        { id: 'start', position: 0, type: 'start', status: 'completed' },
        { id: 'end', position: CONFIG.GAME.DEFAULT_PATH_LENGTH, type: 'end', status: 'future' },
      ],
      totalLength: CONFIG.GAME.DEFAULT_PATH_LENGTH,
      currentPosition: 0,
    });
  };

  const handleNextScenario = () => {
    try {
      // Start door animation
      setShowDoorAnimation(true);
    } catch (error) {
      console.error('Failed to load next scenario:', error);
      setShowDoorAnimation(false);
    }
  };

  const handleAnimationEnd = async () => {
    try {
      console.log('🚪 [GAME] Loading next scenario after door animation...');
      
      // Get next scenario from hardcoded data
      const scenarioData = scenarioService.getRandomScenario();
      console.log('✅ [GAME] Got next scenario:', scenarioData.scenario.substring(0, 50) + '...');

      const nextScenario: GameScenario = {
        id: `scenario_${Date.now()}`,
        content: scenarioData.scenario,
        reasoning: scenarioData.reasoning,
        difficulty: Math.min(3, Math.max(1, Math.floor(Math.random() * 3) + 1)),
      };

      setCurrentScenario(nextScenario);
      setScenarioStartTime(Date.now()); // Track when this new scenario started
      setDoorColor('neutral');
      setCurrentAnalysis(null);
      setShowOutcome(false);
      setWaitingForNext(false);
      setShowDoorAnimation(false);
      console.log('✅ [GAME] Next scenario loaded successfully');
    } catch (error) {
      console.error('❌ [GAME] Failed to load next scenario:', error);
      setShowDoorAnimation(false);
      // Fallback: keep current scenario and allow retry
    }
  };

  const updateGamePath = (scoreResponse: ScoreResponse) => {
    setGamePath((prevPath) => {
      const newPath = { ...prevPath };
      const score = scoreResponse.total_score;

      // Dynamic path adjustment based on score
      let pathAdjustment = 0;
      let doorColor: 'red' | 'yellow' | 'green' = 'yellow';

      if (score >= CONFIG.SCORING.EXCELLENT_THRESHOLD) {
        // Excellent performance - skip a door if possible
        pathAdjustment = -2;
        doorColor = 'green';
      } else if (score >= CONFIG.SCORING.GOOD_THRESHOLD) {
        // Good performance - shorter path
        pathAdjustment = -1;
        doorColor = 'green';
      } else if (score <= CONFIG.SCORING.TERRIBLE_THRESHOLD) {
        // Terrible performance - add extra doors
        pathAdjustment = 2;
        doorColor = 'red';
      } else if (score <= CONFIG.SCORING.POOR_THRESHOLD) {
        // Poor performance - longer path
        pathAdjustment = 1;
        doorColor = 'red';
      }

      // Apply path adjustment with bounds checking
      const newTotalLength = Math.max(
        CONFIG.GAME.MIN_PATH_LENGTH,
        Math.min(CONFIG.GAME.MAX_PATH_LENGTH, newPath.totalLength + pathAdjustment)
      );

      newPath.totalLength = newTotalLength;

      // Add current door to path
      const currentDoorId = `door_${newPath.currentPosition + 1}`;
      const newDoor: PathNode = {
        id: currentDoorId,
        position: newPath.currentPosition + 1,
        type: 'door',
        status: 'completed',
        score: score,
        color: doorColor,
      };

      // Update nodes
      const updatedNodes = [...newPath.nodes];

      // Remove old end node
      updatedNodes.pop();

      // Add new door
      updatedNodes.push(newDoor);

      // Add new end node
      updatedNodes.push({
        id: 'end',
        position: newPath.totalLength,
        type: 'end',
        status: 'future',
      });

      newPath.nodes = updatedNodes;
      newPath.currentPosition += 1;

      return newPath;
    });
  };

  const handleSubmitResponse = async (response: string) => {
    if (!response.trim() || !currentScenario) return;

    try {
      setIsSubmitting(true);
      clearError();

      let analysisResult: ScenarioAnalysis | null = null;
      let scoreResponse: ScoreResponse | null = null;

      // Try Gemini first
      try {
        console.log('Attempting to use Gemini for response analysis...');
        analysisResult = await geminiService.analyzeResponse(
          currentScenario.content,
          response,
          currentScenario.reasoning
        );
        console.log('Gemini analysis successful:', analysisResult);

        // Convert Gemini analysis to ScoreResponse format
        scoreResponse = {
          total_score: analysisResult.score,
          feedback: analysisResult.outcome,
          metrics: {
            creativity: analysisResult.score,
            feasibility: analysisResult.score,
            humor: analysisResult.score,
            originality: analysisResult.score,
          },
          path_recommendation: 'normal_path'
        };
      } catch (geminiError) {
        console.warn('Gemini analysis failed, falling back to local scoring:', geminiError);

        // Calculate response time for this scenario
        const responseTimeSeconds = scenarioStartTime ? Math.floor((Date.now() - scenarioStartTime) / 1000) : undefined;
        
        // Fallback to local scoring service
        scoreResponse = scoringService.scoreResponse(currentScenario.content, response, responseTimeSeconds);
        console.log('Using fallback local scoring:', scoreResponse, 'Response time:', responseTimeSeconds, 's');
      }

      if (scoreResponse) {
        // Store the score for tracking
        setPlayerScores((prev) => [...prev, scoreResponse.total_score]);

        // Store the response for Dum-Stones analysis
        setGameResponses((prev) => [...prev, {
          scenario: currentScenario.content,
          response: response,
          score: scoreResponse.total_score
        }]);

        // Store the analysis for display
        setCurrentAnalysis(scoreResponse);

        // Play sound effect based on score
        playScoreSound(scoreResponse.total_score);

        // Update door color based on score (use Gemini's color if available, otherwise calculate)
        let color: 'red' | 'yellow' | 'green';
        if (analysisResult?.color) {
          color = analysisResult.color;
        } else {
          const score = scoreResponse.total_score;
          if (score >= CONFIG.SCORING.GOOD_THRESHOLD) {
            color = 'green';
          } else if (score <= CONFIG.SCORING.POOR_THRESHOLD) {
            color = 'red';
          } else {
            color = 'yellow';
          }
        }
        setDoorColor(color);

        // Show the outcome
        setShowOutcome(true);

        // Update game path
        updateGamePath(scoreResponse);
      }

      // Response submitted and analyzed

      // Wait a moment to show the door color change and outcome
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check if game is complete
      if (gamePath.currentPosition >= gamePath.totalLength - 1) {
        // Game completed - show results
        const averageScore = playerScores.reduce((a, b) => a + b, 0) / playerScores.length;
        
        // Format total game time
        const formatGameTime = (seconds: number): string => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          return `${mins}m ${secs}s`;
        };
        
        const gameTimeFormatted = formatGameTime(totalGameTime);
        
        const mockResults: GameResultsType = {
          winner: 'player1',
          rankings: [
            {
              playerId: 'player1',
              username: username || 'You',
              position: 1,
              totalScore: Math.round(averageScore * playerScores.length),
              completionTime: gameTimeFormatted,
            },
          ],
          statistics: [
            {
              playerId: 'player1',
              averageScore: Math.round(averageScore * 10) / 10,
              doorsCompleted: gamePath.currentPosition,
              totalTime: totalGameTime.toString(), // Store as seconds for calculations
            },
          ],
          sessionId: `demo-session-${Date.now()}`,
          gameMode: 'single-player',
          completedAt: new Date().toISOString(),
        };

        setGameResults(mockResults);

        // Submit to leaderboard
        try {
          console.log('📊 Submitting game results to leaderboard...');
          const response = await fetch('/api/leaderboard/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              gameResults: mockResults,
              gameResponses: gameResponses, // Include game responses for DumStone
            }),
          });

          if (response.ok) {
            console.log('✅ Game results submitted to leaderboard successfully');
            
            // Update hasPlayedBefore state since user just completed a game
            setHasPlayedBefore(true);

            // Update user flair if we have a username
            if (username) {
              try {
                await fetch(`/api/reddit/update-flair/${username}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                console.log('✅ User flair update requested');
              } catch (flairError) {
                console.warn('⚠️ Failed to update flair:', flairError);
              }
            }
          } else {
            console.warn('⚠️ Failed to submit to leaderboard:', await response.text());
          }
        } catch (leaderboardError) {
          console.error('❌ Error submitting to leaderboard:', leaderboardError);
          // Don't block the game flow if leaderboard submission fails
        }

        setGameState('results');
      } else {
        // Wait for user to click next
        setWaitingForNext(true);
      }
    } catch (error) {
      handleError(error as Error, 'submit_response');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show error state if there's an unrecoverable error
  if (errorState.hasError && errorState.retryCount >= 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Game Error</h1>
          <p className="text-xl mb-6">Something went wrong. Please refresh the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-red-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Login Screen
  if (gameState === 'login') {
    return (
      <ErrorBoundary>
        <div className="relative min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 overflow-hidden">
          {/* Fullscreen Logo */}
          <img
            src="/logo.png"
            alt="DumDoors Logo"
            className="absolute inset-0 w-full h-full object-contain md:object-cover animate-fade-in"
            onLoad={() => {
              console.log('Logo loaded successfully');
            }}
            onError={(e) => {
              console.log('Logo failed to load');
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Dark Overlay for Better Button Visibility */}
          <div className="absolute inset-0 bg-black/30"></div>

          {/* Overlaid Start Button at Bottom */}
          <div className="relative z-10 min-h-screen flex items-end justify-center pb-16">
            <button
              onClick={handleLogin}
              className="bg-gradient-to-r from-blue-600/90 to-blue-700/90 backdrop-blur-sm text-white px-12 py-4 rounded-xl font-semibold text-xl hover:from-blue-700/90 hover:to-blue-800/90 transform hover:scale-105 transition-all duration-200 shadow-2xl border border-white/20"
            >
              Enter Game
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Main Menu
  if (gameState === 'menu') {
    return (
      <ErrorBoundary>
        <div className="relative min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 overflow-hidden">
          {/* Fullscreen Menu Background */}
          <img
            src="/menu.jpg"
            alt="DumDoors Menu"
            className="absolute inset-0 w-full h-full object-cover animate-fade-in"
            onLoad={() => {
              console.log('Menu background loaded successfully');
            }}
            onError={(e) => {
              console.log('Menu background failed to load, showing fallback');
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Fallback - Only shows if image fails */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {/* No fallback text - just let the gradient background show */}
            </div>
          </div>

          {/* Dark Overlay for Better Button Visibility */}
          <div className="absolute inset-0 bg-black/30"></div>

          {/* TOP LEFT CORNER - Game Title & Version - Mobile Responsive */}
          <div className="absolute top-2 left-2 md:top-4 md:left-4 z-10">
            <div className="bg-black/40 backdrop-blur-lg rounded-lg md:rounded-xl p-2 md:p-4 border border-white/20">
              <div className="text-white text-center">
                <h3 className="text-sm md:text-lg font-bold mb-1">DumDoors</h3>
                <p className="text-xs md:text-sm text-blue-200">v1.0.0</p>
              </div>
            </div>
          </div>

          {/* TOP RIGHT CORNER - Control Buttons - Mobile Responsive */}
          <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10">
            <div className="flex gap-1 md:gap-3">
              {/* Volume Control */}
              <button
                onClick={toggleMute}
                className={`bg-black/40 backdrop-blur-lg rounded-lg md:rounded-xl p-2 md:p-4 border border-white/20 hover:bg-black/50 transition-all ${isMuted ? 'ring-2 ring-red-500' : ''
                  }`}
                title={isMuted ? 'Unmute Music' : 'Mute Music'}
              >
                <div className="text-white text-sm md:text-xl">{isMuted ? '🔇' : '🔊'}</div>
              </button>

              {/* Sound Effects Control */}
              <button
                onClick={toggleSoundEffects}
                className={`bg-black/40 backdrop-blur-lg rounded-lg md:rounded-xl p-2 md:p-4 border border-white/20 hover:bg-black/50 transition-all ${isSoundEnabled && soundsLoaded ? 'ring-2 ring-blue-500' :
                  isSoundEnabled && !soundsLoaded ? 'ring-2 ring-yellow-500' :
                    'ring-2 ring-gray-500'
                  }`}
                title={
                  !soundsLoaded ? 'Sound Effects (Files Missing)' :
                    isSoundEnabled ? 'Disable Sound Effects' : 'Enable Sound Effects'
                }
              >
                <div className="text-white text-sm md:text-xl">
                  {!soundsLoaded ? '⚠️' : isSoundEnabled ? '🔔' : '🔕'}
                </div>
              </button>

              {/* Settings */}
              <button className="bg-black/40 backdrop-blur-lg rounded-lg md:rounded-xl p-2 md:p-4 border border-white/20 hover:bg-black/50 transition-all">
                <div className="text-white text-sm md:text-xl">⚙️</div>
              </button>
            </div>
          </div>

          {/* BOTTOM LEFT CORNER - Profile Section - Mobile Responsive */}
          <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 z-10">
            <div className="bg-black/40 backdrop-blur-lg rounded-lg md:rounded-xl p-2 md:p-4 border border-white/20">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm md:text-xl">
                    {username ? username.charAt(0).toUpperCase() : 'R'}
                  </span>
                </div>
                <div className="text-white">
                  <p className="font-semibold text-xs md:text-base">u/{username || 'anonymous'}</p>
                  <p className="text-xs md:text-sm text-orange-200">Reddit User</p>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM RIGHT CORNER - Game Stats - Mobile Responsive */}
          <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 z-10">
            <div className="bg-black/40 backdrop-blur-lg rounded-lg md:rounded-xl p-2 md:p-4 border border-white/20">
              <div className="text-white text-right">
                <div className="text-xs md:text-sm text-blue-200 mb-1">🎮 Games: 0</div>
                <div className="text-xs md:text-sm text-blue-200 mb-1">🏆 Best: --</div>
                <div className="flex items-center gap-1 md:gap-2 justify-end">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs md:text-sm">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM CENTER - Tagline and Menu Buttons - Mobile Responsive */}
          <div className="absolute bottom-16 md:bottom-20 left-1/2 transform -translate-x-1/2 z-10 px-4 w-full max-w-sm md:max-w-md">
            <div className="flex flex-col items-center gap-4 md:gap-6">
              {/* Tagline */}
              <div className="text-center mb-2">
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 text-lg md:text-2xl font-black tracking-wider animate-pulse drop-shadow-lg">
                  ✨ CHOOSE YOUR FATE ✨
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3 md:gap-4 w-full">
                <button
                  onClick={handleStartGame}
                  className="bg-gradient-to-r from-amber-500/90 via-orange-500/90 to-red-500/90 backdrop-blur-sm text-white px-8 py-3 md:px-12 md:py-4 rounded-xl font-bold text-base md:text-lg hover:from-amber-600/90 hover:via-orange-600/90 hover:to-red-600/90 transform hover:scale-105 transition-all duration-200 shadow-2xl border-2 border-amber-400/40 hover:border-amber-300/60 hover:shadow-amber-500/25"
                >
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <span className="text-xl md:text-2xl">🎮</span>
                    <span>Start New Game</span>
                  </div>
                </button>

                <button
                  onClick={handleViewLeaderboard}
                  className="bg-gradient-to-r from-purple-600/90 via-blue-600/90 to-cyan-500/90 backdrop-blur-sm text-white px-8 py-3 md:px-12 md:py-4 rounded-xl font-bold text-base md:text-lg hover:from-purple-700/90 hover:via-blue-700/90 hover:to-cyan-600/90 transform hover:scale-105 transition-all duration-200 shadow-2xl border-2 border-purple-400/40 hover:border-purple-300/60 hover:shadow-purple-500/25"
                >
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <span className="text-xl md:text-2xl">🏆</span>
                    <span>Leaderboard</span>
                  </div>
                </button>

                {/* DumStone Button - Available if user has played before or has current responses */}
                <button
                  onClick={(gameResponses.length > 0 || hasPlayedBefore) ? handleViewDumStones : undefined}
                  disabled={gameResponses.length === 0 && !hasPlayedBefore}
                  className={`px-8 py-3 md:px-12 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all duration-200 shadow-2xl border-2 ${
                    (gameResponses.length > 0 || hasPlayedBefore)
                      ? 'bg-gradient-to-r from-pink-600/90 via-rose-600/90 to-red-500/90 backdrop-blur-sm text-white hover:from-pink-700/90 hover:via-rose-700/90 hover:to-red-600/90 transform hover:scale-105 border-pink-400/40 hover:border-pink-300/60 hover:shadow-pink-500/25 cursor-pointer'
                      : 'bg-gradient-to-r from-gray-600/50 via-gray-700/50 to-gray-800/50 backdrop-blur-sm text-gray-400 border-gray-500/40 cursor-not-allowed opacity-60'
                  }`}
                  title={(gameResponses.length === 0 && !hasPlayedBefore) ? 'Play at least one game to unlock your DumStone' : 'View your DumStone'}
                >
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <span className="text-xl md:text-2xl">🪦</span>
                    <span>DumStone</span>
                    {(gameResponses.length === 0 && !hasPlayedBefore) && (
                      <span className="text-lg">🔒</span>
                    )}
                  </div>
                </button>


              </div>
            </div>
          </div>
        </div>

        {/* Floating Multi-Player Notice - Central Bottom */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-[500px] max-w-[90vw] overflow-hidden border border-white/10 rounded-lg">
          <div className="relative h-10 flex items-center">
            <div className="animate-marquee whitespace-nowrap text-white font-bold text-base tracking-wide drop-shadow-lg">
              🎮 Multi-Player coming soon! 🎮 Get ready for epic battles! 🎮 Multi-Player coming soon! 🎮 Get ready for epic battles! 🎮
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Main Game Interface
  if (gameState === 'playing') {
    return (
      <ErrorBoundary>
        <div className="relative min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex flex-col md:flex-row">
          {/* Full Screen Pulse Overlay */}
          {doorColor !== 'neutral' && currentAnalysis && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {/* Screen-wide pulse effect */}
              <div
                className={`absolute inset-0 ${doorColor === 'green'
                  ? 'bg-green-500/10'
                  : doorColor === 'yellow'
                    ? 'bg-yellow-500/10'
                    : 'bg-red-500/10'
                  } animate-pulse`}
                style={{ animationDuration: '1.5s' }}
              />

              {/* Score-specific full-screen effects */}
              {currentAnalysis.total_score >= 70 && (
                <div className="absolute inset-0">
                  {/* Success confetti-like effect */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={`success-particle-${i}`}
                      className="absolute w-3 h-3 bg-green-400 rounded-full animate-ping"
                      style={{
                        top: `${10 + (i * 7)}%`,
                        left: `${5 + (i * 8)}%`,
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: '2s'
                      }}
                    />
                  ))}
                  {/* Additional particles from right side */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={`success-particle-right-${i}`}
                      className="absolute w-2 h-2 bg-green-300 rounded-full animate-ping"
                      style={{
                        top: `${15 + (i * 6)}%`,
                        right: `${5 + (i * 7)}%`,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: '1.8s'
                      }}
                    />
                  ))}
                </div>
              )}

              {currentAnalysis.total_score <= 30 && (
                <div className="absolute inset-0">
                  {/* Failure screen shake effect */}
                  <div
                    className="absolute inset-0 bg-red-600/15 animate-pulse"
                    style={{ animationDuration: '0.5s' }}
                  />
                  {/* Warning borders */}
                  <div className="absolute top-0 left-0 right-0 h-2 bg-red-500/60 animate-pulse" />
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-red-500/60 animate-pulse" />
                  <div className="absolute top-0 bottom-0 left-0 w-2 bg-red-500/60 animate-pulse" />
                  <div className="absolute top-0 bottom-0 right-0 w-2 bg-red-500/60 animate-pulse" />
                </div>
              )}
            </div>
          )}
          {/* Mobile Map Overlay */}
          {showMobileMap && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden flex items-center justify-center p-4">
              <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-4 w-full max-w-sm h-[70vh] border border-white/20">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-bold text-lg">🗺️ Game Map</h3>
                  <button
                    onClick={() => setShowMobileMap(false)}
                    className="bg-red-500/80 text-white px-3 py-1 rounded-lg hover:bg-red-600/80 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="h-full">
                  <GameMinimap gamePath={gamePath} className="h-full" />
                </div>
              </div>
            </div>
          )}

          {/* LEFT SIDE - Map and Info - Desktop Only */}
          <div className="hidden md:flex md:w-1/2 p-4 flex-col h-screen order-2 md:order-1">
            {/* Desktop: Vertical Info Section */}
            <div className="mb-4 space-y-3 h-[20%]">
              <div className="flex flex-col gap-0 space-y-3">
                <button
                  onClick={handleBackToMenu}
                  className="bg-black/40 backdrop-blur-lg text-white px-3 py-2 rounded-lg hover:bg-black/50 transition-colors border border-white/20 text-sm flex-shrink-0"
                >
                  ← Menu
                </button>

                {/* Game Info */}
                <div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                  <h3 className="text-white font-semibold text-lg mb-3">🎮 Game Info</h3>
                  <div className="space-y-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-gray-300 text-sm">Total Time:</span>
                      <span className="text-white font-bold text-2xl font-mono">{Math.floor(totalGameTime / 60)}:{(totalGameTime % 60).toString().padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Minimap */}
            <div className="flex-1 h-[80%]">
              <GameMinimap gamePath={gamePath} className="h-full" />
            </div>
          </div>

          {/* Mobile Top Bar */}
          <div className="md:hidden w-full p-2 order-1">
            <div className="flex gap-2">
              <button
                onClick={handleBackToMenu}
                className="bg-black/40 backdrop-blur-lg text-white px-2 py-1 rounded-lg hover:bg-black/50 transition-colors border border-white/20 text-xs flex-shrink-0"
              >
                ← Menu
              </button>

              <button
                onClick={() => setShowMobileMap(true)}
                className="bg-black/40 backdrop-blur-lg text-white px-2 py-1 rounded-lg hover:bg-black/50 transition-colors border border-white/20 text-xs flex-shrink-0"
              >
                🗺️ Map
              </button>

              {/* Mobile Game Info */}
              <div className="bg-black/40 backdrop-blur-lg rounded-lg p-3 border border-white/20 flex-1">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-gray-300 text-xs">Total Time:</span>
                  <span className="text-white font-bold text-lg font-mono">{Math.floor(totalGameTime / 60)}:{(totalGameTime % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Big Door - Mobile Responsive */}
          <div className="w-full md:w-1/2 p-2 md:p-4 flex items-center justify-center order-2 md:order-2 flex-1">
            <div className="relative w-full h-[calc(100vh-80px)] md:h-full max-h-[calc(100vh-80px)] md:max-h-[90vh]">
              {/* Big Door Container */}
              <div className="relative w-full h-full rounded-3xl shadow-2xl pointer-events-none overflow-hidden">
                {/* Door Image Background */}
                <img
                  src="/door.png"
                  alt="Door"
                  className="absolute inset-0 w-full h-full object-cover rounded-3xl pointer-events-none"
                  onError={(e) => {
                    console.log('Door image failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />

                {/* Color Overlay for Door States */}
                <div
                  className={`absolute inset-0 rounded-3xl transition-all duration-1000 pointer-events-none ${doorColor === 'red'
                    ? 'bg-red-500/10 shadow-red-500/50'
                    : doorColor === 'yellow'
                      ? 'bg-yellow-500/10 shadow-yellow-500/50'
                      : doorColor === 'green'
                        ? 'bg-green-500/10 shadow-green-500/50'
                        : 'bg-transparent'
                    } ${doorColor !== 'neutral' ? 'animate-door-color-change' : 'animate-door-glow'}`}
                ></div>

                {/* Score-based Pulse Animations */}
                {doorColor !== 'neutral' && currentAnalysis && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Pulse Ring 1 - Inner */}
                    <div
                      className={`absolute inset-4 rounded-3xl border-4 ${doorColor === 'green'
                        ? 'border-green-400/60 animate-ping'
                        : doorColor === 'yellow'
                          ? 'border-yellow-400/60 animate-ping'
                          : 'border-red-400/60 animate-ping'
                        }`}
                      style={{ animationDuration: '2s' }}
                    ></div>

                    {/* Pulse Ring 2 - Middle */}
                    <div
                      className={`absolute inset-2 rounded-3xl border-2 ${doorColor === 'green'
                        ? 'border-green-300/40 animate-ping'
                        : doorColor === 'yellow'
                          ? 'border-yellow-300/40 animate-ping'
                          : 'border-red-300/40 animate-ping'
                        }`}
                      style={{ animationDuration: '2.5s', animationDelay: '0.3s' }}
                    ></div>

                    {/* Pulse Ring 3 - Outer */}
                    <div
                      className={`absolute -inset-2 rounded-3xl border ${doorColor === 'green'
                        ? 'border-green-200/30 animate-ping'
                        : doorColor === 'yellow'
                          ? 'border-yellow-200/30 animate-ping'
                          : 'border-red-200/30 animate-ping'
                        }`}
                      style={{ animationDuration: '3s', animationDelay: '0.6s' }}
                    ></div>

                    {/* Score-based Particle Effects */}
                    {currentAnalysis.total_score >= 70 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Success Sparkles */}
                        {[...Array(8)].map((_, i) => (
                          <div
                            key={`sparkle-${i}`}
                            className="absolute w-2 h-2 bg-green-400 rounded-full animate-ping"
                            style={{
                              top: `${20 + (i * 10)}%`,
                              left: `${15 + (i * 8)}%`,
                              animationDelay: `${i * 0.2}s`,
                              animationDuration: '1.5s'
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {currentAnalysis.total_score <= 30 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Failure Warning Flashes */}
                        <div
                          className="absolute inset-0 bg-red-500/20 rounded-3xl animate-pulse"
                          style={{ animationDuration: '0.8s' }}
                        />
                        <div
                          className="absolute inset-6 bg-red-400/30 rounded-3xl animate-pulse"
                          style={{ animationDuration: '1.2s', animationDelay: '0.4s' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Door Animation Overlay */}
                {showDoorAnimation && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-3xl">
                    <video
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover rounded-3xl"
                      onEnded={handleAnimationEnd}
                      onError={(e) => {
                        console.log('Door animation failed to load:', e);
                        setShowDoorAnimation(false);
                      }}
                      onLoadStart={() => console.log('Door animation loading...')}
                      onCanPlay={() => console.log('Door animation can play')}
                      onPlay={() => console.log('Door animation started playing')}
                    >
                      <source src={`/dooranimation.mp4?v=${Date.now()}`} type="video/mp4" />
                      <source src={`./dooranimation.mp4?v=${Date.now()}`} type="video/mp4" />
                      <source src={`dooranimation.mp4?v=${Date.now()}`} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* Door Content Container */}
                <div className="absolute inset-3 md:inset-6 lg:inset-12 flex flex-col z-10 pointer-events-auto">
                  {/* Scenario Section - Top of Door */}
                  <div className="mb-2 md:mb-4 lg:mb-8 flex-none md:flex-1 min-h-0">
                    <div className="bg-black/30 backdrop-blur-lg rounded-xl p-3 md:p-4 lg:p-6 border border-white/20 h-32 md:h-full flex flex-col">
                      <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-white mb-2 md:mb-4 flex items-center gap-2 md:gap-3 flex-shrink-0">
                        📖 <span>Current Scenario</span>
                      </h2>
                      {currentScenario ? (
                        <div className="flex-1 overflow-y-auto">
                          <p className="text-gray-100 text-sm md:text-base lg:text-lg leading-relaxed">
                            {currentScenario.content}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-gray-300 flex-1 justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          <span className="text-base md:text-lg">Loading scenario...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Response Input Section - Middle of Door */}
                  {!waitingForNext && !showOutcome && (
                    <div className="flex-1 min-h-0">
                      <div className="bg-black/30 backdrop-blur-lg rounded-xl p-3 md:p-4 lg:p-6 border border-white/20 h-full flex flex-col">
                        <h3 className="text-base md:text-lg lg:text-xl font-bold text-white mb-2 md:mb-4 flex items-center gap-2 md:gap-3 flex-shrink-0">
                          💭 <span>Your Response</span>
                        </h3>

                        <div className="flex-1">
                          <VoiceResponseInput
                            onSubmit={handleSubmitResponse}
                            maxLength={CONFIG.GAME.MAX_RESPONSE_LENGTH}
                            placeholder="Describe what you would do in this situation..."
                            disabled={isSubmitting || !currentScenario || waitingForNext}
                            autoFocus={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Door Status Indicator and Analysis - Bottom of Door */}
                  {showOutcome && currentAnalysis && (
                    <div className="flex-1 min-h-0 flex flex-col">
                      <div className="text-center mb-2 md:mb-4 flex-shrink-0">
                        <div
                          className={`inline-block px-3 md:px-4 lg:px-6 py-1 md:py-2 lg:py-3 rounded-full text-white font-bold text-base md:text-lg lg:text-xl backdrop-blur-lg border-2 ${currentAnalysis.total_score >= CONFIG.SCORING.GOOD_THRESHOLD
                            ? 'bg-green-500/80 border-green-300'
                            : currentAnalysis.total_score <= CONFIG.SCORING.POOR_THRESHOLD
                              ? 'bg-red-500/80 border-red-300'
                              : 'bg-yellow-500/80 border-yellow-300'
                            } animate-fade-in`}
                        >
                          Score: {Math.round(currentAnalysis.total_score)}/100{' '}
                          {currentAnalysis.total_score >= CONFIG.SCORING.GOOD_THRESHOLD
                            ? '😊'
                            : currentAnalysis.total_score <= CONFIG.SCORING.POOR_THRESHOLD
                              ? '😞'
                              : '😐'}
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-3 md:p-4 lg:p-6 border border-white/30 animate-slide-in-up flex-1 min-h-0 flex flex-col">
                        <h3 className="text-base md:text-lg lg:text-xl font-bold text-white mb-2 md:mb-3 flex items-center gap-2 flex-shrink-0">
                          🤖 <span>AI Response</span>
                        </h3>

                        {currentAnalysis.feedback && (
                          <div className="p-3 md:p-4 bg-black/20 rounded-lg mb-3 md:mb-4 flex-1 overflow-y-auto">
                            <div className="text-white text-sm md:text-base lg:text-lg leading-relaxed">
                              {currentAnalysis.feedback}
                            </div>
                          </div>
                        )}

                        {/* Next Button */}
                        {waitingForNext && (
                          <div className="text-center flex-shrink-0">
                            <button
                              onClick={handleNextScenario}
                              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 md:px-8 py-2 md:py-3 rounded-xl font-semibold text-base md:text-lg hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg animate-pulse"
                            >
                              Continue to Next Door →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* AnnoyedDoru Full Scenario Section Overlay */}
                {isSubmitting && (
                  <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm rounded-3xl">
                    {/* Full scenario section - AnnoyedDoru Video */}
                    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 lg:p-8">
                      {/* Full-height video container that fills the entire scenario section */}
                      <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover rounded-2xl border-4 border-orange-400/50 shadow-2xl shadow-orange-500/30"
                          onError={(e) => {
                            console.log('AnnoyedDoru video failed to load:', e);
                            // Show fallback content
                            e.currentTarget.style.display = 'none';
                          }}
                        >
                          <source src="/Doru/AnnoyedDoru.mp4" type="video/mp4" />
                        </video>
                        
                        {/* Fallback content if video fails */}
                        <div className="w-full h-full bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl border-4 border-orange-400/50 flex items-center justify-center" style={{ display: 'none' }}>
                          <div className="text-center text-white">
                            <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-white mx-auto mb-4"></div>
                            <div className="text-xl font-bold">Loading...</div>
                          </div>
                        </div>

                        {/* Text overlay at bottom */}
                        <div className="absolute bottom-4 md:bottom-6 lg:bottom-8 left-0 right-0 text-center">
                          <div className="bg-black/80 backdrop-blur-lg rounded-2xl p-3 md:p-4 lg:p-6 mx-4 border border-orange-400/30">
                            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 animate-pulse">
                              Ahh i gotta wait..
                            </div>
                            <div className="text-orange-300 text-base md:text-lg lg:text-xl">
                              AI is thinking... 🤔
                            </div>
                            
                            {/* Loading dots */}
                            <div className="flex justify-center mt-3 space-x-2">
                              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Door Glow Effect */}
                <div
                  className={`absolute inset-0 rounded-3xl transition-all duration-1000 ${doorColor === 'red'
                    ? 'shadow-[0_0_100px_rgba(239,68,68,0.3)]'
                    : doorColor === 'yellow'
                      ? 'shadow-[0_0_100px_rgba(234,179,8,0.3)]'
                      : doorColor === 'green'
                        ? 'shadow-[0_0_100px_rgba(34,197,94,0.3)]'
                        : 'shadow-[0_0_80px_rgba(59,130,246,0.2)]'
                    } ${doorColor !== 'neutral' ? 'animate-success-pulse' : ''}`}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Leaderboard Screen
  if (gameState === 'leaderboard') {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-8">
              <button
                onClick={handleBackToMenu}
                className="absolute top-4 left-4 bg-white/10 backdrop-blur-lg text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Back to Menu
              </button>

              <img
                src="/logo.png"
                alt="DumDoors Logo"
                className="w-24 h-24 mx-auto mb-4 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                🏆 Global Leaderboard
              </h1>
              <p className="text-blue-200">See how you stack up against other players</p>
            </div>

            {/* Leaderboard Component */}
            <Leaderboard />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Game Results Screen
  if (gameState === 'results' && gameResults) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <GameResults
              results={gameResults}
              currentPlayerId="player1"
              onPlayAgain={() => {
                setGameState('playing');
                setGameResults(null);
                setCurrentScenario(null);
                setPlayerScores([]);
                setCurrentAnalysis(null);
                setDoorColor('neutral');
                setShowOutcome(false);
                setWaitingForNext(false);
                setGameStartTime(null);
                setTotalGameTime(0);
                setScenarioStartTime(null);
                setGamePath({
                  nodes: [
                    { id: 'start', position: 0, type: 'start', status: 'completed' },
                    {
                      id: 'end',
                      position: CONFIG.GAME.DEFAULT_PATH_LENGTH,
                      type: 'end',
                      status: 'future',
                    },
                  ],
                  totalLength: CONFIG.GAME.DEFAULT_PATH_LENGTH,
                  currentPosition: 0,
                });
              }}
              onViewLeaderboard={handleViewLeaderboard}
              onBackToLobby={handleBackToMenu}
            />
          </div>
        </div>
      </ErrorBoundary>
    );
  }



  // DumStones Page
  if (gameState === 'dumstones') {
    console.log('🃏 [DEBUG] Rendering DumStones page, dumStoneReport:', dumStoneReport);
    return (
      <ErrorBoundary>
        <div className="min-h-screen" style={{ backgroundColor: '#000f3e' }}>
          <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-8">
              <button
                onClick={handleCloseDumStones}
                className="absolute top-4 left-4 bg-white/10 backdrop-blur-lg text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Back to Menu
              </button>

              <img
                src="/logo.png"
                alt="DumDoors Logo"
                className="w-24 h-24 mx-auto mb-4 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                🪦 Your DumStone
              </h1>
              <p className="text-blue-200">AI-powered personality analysis based on your game decisions</p>
            </div>

            {/* Content */}
            <div className="flex justify-center">
              {dumStoneReport === 'generating' && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
                  {/* Full-screen waiting video */}
                  <div className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 lg:p-8">
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full max-w-2xl h-auto object-contain rounded-2xl border-4 border-purple-400/50 shadow-2xl shadow-purple-500/30"
                      onError={(e) => {
                        console.log('Waiting video failed to load:', e);
                        // Show fallback content
                        e.currentTarget.style.display = 'none';
                      }}
                    >
                      <source src="/waiting.mp4" type="video/mp4" />
                    </video>
                    
                    {/* Fallback content if video fails */}
                    <div className="w-full max-w-2xl h-96 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl border-4 border-purple-400/50 flex items-center justify-center" style={{ display: 'none' }}>
                      <div className="text-center text-white">
                        <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-white mx-auto mb-4"></div>
                        <div className="text-2xl font-bold">Analyzing...</div>
                      </div>
                    </div>

                    {/* Text overlay at bottom */}
                    <div className="absolute bottom-8 left-0 right-0 text-center">
                      <div className="bg-black/80 backdrop-blur-lg rounded-2xl p-4 md:p-6 mx-4 border border-purple-400/30">
                        <div className="text-2xl md:text-3xl font-bold text-white mb-2 animate-pulse">
                          AI is analyzing your personality...
                        </div>
                        <div className="text-purple-300 text-lg md:text-xl">
                          Preparing your DumStone... 🪦
                        </div>
                        
                        {/* Loading dots */}
                        <div className="flex justify-center mt-3 space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {dumStoneReport === 'error' && (
                <div className="bg-white rounded-2xl p-8 text-center max-w-md">
                  <div className="text-6xl mb-4">😵</div>
                  <div className="text-xl font-bold mb-2 text-gray-800">Oops! Something went wrong</div>
                  <div className="text-gray-600 mb-6">Our AI got too excited analyzing you and crashed.</div>
                  <button
                    onClick={handleViewDumStones}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {dumStoneReport && dumStoneReport !== 'generating' && dumStoneReport !== 'error' && (
                <DumStoneReportCard
                  report={dumStoneReport}
                  onClose={handleCloseDumStones}
                  onCopyRoast={() => {
                    const dumStoneText = `My DumStone: ${dumStoneReport.title} - ${dumStoneReport.roast}`;
                    navigator.clipboard?.writeText(dumStoneText);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return null;
};
