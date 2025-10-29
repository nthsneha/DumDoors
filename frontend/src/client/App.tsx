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
import { CONFIG } from './constants/config';
import type { GameResults as GameResultsType } from '../shared/types/api';

type GameState = 'login' | 'menu' | 'playing' | 'leaderboard' | 'results';

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
  const { isSoundEnabled, isLoaded: soundsLoaded, playScoreSound, toggleSoundEffects, testSound } = useSoundEffects();
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
  const [timeLeft, setTimeLeft] = useState<number>(CONFIG.GAME.DEFAULT_TIME_LIMIT);
  const [gameResults, setGameResults] = useState<GameResultsType | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<ScoreResponse | null>(null);
  const [playerScores, setPlayerScores] = useState<number[]>([]);
  const [showOutcome, setShowOutcome] = useState(false);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [showDoorAnimation, setShowDoorAnimation] = useState(false);

  // Timer for response phase
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0 && !isSubmitting) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState, timeLeft, isSubmitting]);

  // Initialize first scenario when game starts
  useEffect(() => {
    if (gameState === 'playing' && !currentScenario) {
      initializeGame();
    }
  }, [gameState, currentScenario]);

  const initializeGame = async () => {
    try {
      // Get first scenario from CSV
      const scenarioData = await scenarioService.getRandomScenario();

      const firstScenario: GameScenario = {
        id: `scenario_${Date.now()}`,
        content: scenarioData.scenario,
        reasoning: scenarioData.reasoning,
        difficulty: 1,
      };

      setCurrentScenario(firstScenario);
      setTimeLeft(CONFIG.GAME.DEFAULT_TIME_LIMIT);
    } catch (error) {
      console.error('Failed to initialize game:', error);
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
  };

  const handleViewLeaderboard = () => {
    setGameState('leaderboard');
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
      // Get next scenario from CSV
      const scenarioData = await scenarioService.getRandomScenario();

      const nextScenario: GameScenario = {
        id: `scenario_${Date.now()}`,
        content: scenarioData.scenario,
        reasoning: scenarioData.reasoning,
        difficulty: Math.min(3, Math.max(1, Math.floor(Math.random() * 3) + 1)),
      };

      setCurrentScenario(nextScenario);
      setDoorColor('neutral');
      setCurrentAnalysis(null);
      setShowOutcome(false);
      setWaitingForNext(false);
      setTimeLeft(CONFIG.GAME.DEFAULT_TIME_LIMIT);
      setShowDoorAnimation(false);
    } catch (error) {
      console.error('Failed to load next scenario:', error);
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

      // Score the response using scoring service
      const scoreResponse = scoringService.scoreResponse(currentScenario.content, response);

      // Store the score for tracking
      setPlayerScores((prev) => [...prev, scoreResponse.total_score]);

      // Store the analysis for display
      setCurrentAnalysis(scoreResponse);

      // Play sound effect based on score
      playScoreSound(scoreResponse.total_score);

      // Update door color based on score
      const score = scoreResponse.total_score;
      let color: 'red' | 'yellow' | 'green' = 'yellow';
      if (score >= CONFIG.SCORING.GOOD_THRESHOLD) {
        color = 'green';
      } else if (score <= CONFIG.SCORING.POOR_THRESHOLD) {
        color = 'red';
      }
      setDoorColor(color);

      // Show the outcome
      setShowOutcome(true);

      // Update game path
      updateGamePath(scoreResponse);

      // Response submitted and scored locally

      // Wait a moment to show the door color change and outcome
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check if game is complete
      if (gamePath.currentPosition >= gamePath.totalLength - 1) {
        // Game completed - show results
        const averageScore = playerScores.reduce((a, b) => a + b, 0) / playerScores.length;
        const mockResults: GameResultsType = {
          winner: 'player1',
          rankings: [
            {
              playerId: 'player1',
              username: username || 'You',
              position: 1,
              totalScore: Math.round(averageScore * playerScores.length),
              completionTime: '4m 32s',
            },
          ],
          statistics: [
            {
              playerId: 'player1',
              averageScore: Math.round(averageScore * 10) / 10,
              doorsCompleted: gamePath.currentPosition,
              totalTime: '4m 32s',
            },
          ],
          sessionId: `demo-session-${Date.now()}`,
          gameMode: 'single-player',
          completedAt: new Date().toISOString(),
        };

        setGameResults(mockResults);
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
            className="absolute inset-0 w-full h-full object-cover animate-fade-in"
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

          {/* TOP LEFT CORNER - Game Title & Version */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="text-white text-center">
                <h3 className="text-lg font-bold mb-1">DumDoors</h3>
                <p className="text-sm text-blue-200">v1.0.0</p>
              </div>
            </div>
          </div>

          {/* TOP RIGHT CORNER - Control Buttons */}
          <div className="absolute top-4 right-4 z-10">
            <div className="flex gap-3">
              {/* Volume Control */}
              <button
                onClick={toggleMute}
                className={`bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:bg-black/50 transition-all ${
                  isMuted ? 'ring-2 ring-red-500' : ''
                }`}
                title={isMuted ? 'Unmute Music' : 'Mute Music'}
              >
                <div className="text-white text-xl">{isMuted ? '🔇' : '🔊'}</div>
              </button>

              {/* Sound Effects Control */}
              <button
                onClick={toggleSoundEffects}
                className={`bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:bg-black/50 transition-all ${
                  isSoundEnabled && soundsLoaded ? 'ring-2 ring-blue-500' : 
                  isSoundEnabled && !soundsLoaded ? 'ring-2 ring-yellow-500' : 
                  'ring-2 ring-gray-500'
                }`}
                title={
                  !soundsLoaded ? 'Sound Effects (Files Missing)' :
                  isSoundEnabled ? 'Disable Sound Effects' : 'Enable Sound Effects'
                }
              >
                <div className="text-white text-xl">
                  {!soundsLoaded ? '⚠️' : isSoundEnabled ? '🔔' : '🔕'}
                </div>
              </button>

              {/* Test Sound Button (for debugging) */}
              <button
                onClick={testSound}
                className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:bg-black/50 transition-all"
                title="Test Sound Effects"
              >
                <div className="text-white text-xl">🧪</div>
              </button>

              {/* Settings */}
              <button className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:bg-black/50 transition-all">
                <div className="text-white text-xl">⚙️</div>
              </button>
            </div>
          </div>

          {/* BOTTOM LEFT CORNER - Profile Section */}
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    {username ? username.charAt(0).toUpperCase() : 'P'}
                  </span>
                </div>
                <div className="text-white">
                  <p className="font-semibold">{username || 'Player'}</p>
                  <p className="text-sm text-blue-200">Level 1</p>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM RIGHT CORNER - Game Stats */}
          <div className="absolute bottom-4 right-4 z-10">
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="text-white text-right">
                <div className="text-sm text-blue-200 mb-1">🎮 Games: 0</div>
                <div className="text-sm text-blue-200 mb-1">🏆 Best: --</div>
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Online: 1,337</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM CENTER - Tagline and Menu Buttons */}
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex flex-col items-center gap-6">
              {/* Tagline */}
              <div className="text-center mb-2">
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 text-2xl font-black tracking-wider animate-pulse drop-shadow-lg">
                  ✨ CHOOSE YOUR FATE ✨
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleStartGame}
                  className="bg-gradient-to-r from-amber-500/90 via-orange-500/90 to-red-500/90 backdrop-blur-sm text-white px-12 py-4 rounded-xl font-bold text-lg hover:from-amber-600/90 hover:via-orange-600/90 hover:to-red-600/90 transform hover:scale-105 transition-all duration-200 shadow-2xl border-2 border-amber-400/40 hover:border-amber-300/60 hover:shadow-amber-500/25"
                >
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">🎮</span>
                    <span>Start New Game</span>
                  </div>
                </button>

                <button
                  onClick={handleViewLeaderboard}
                  className="bg-gradient-to-r from-purple-600/90 via-blue-600/90 to-cyan-500/90 backdrop-blur-sm text-white px-12 py-4 rounded-xl font-bold text-lg hover:from-purple-700/90 hover:via-blue-700/90 hover:to-cyan-600/90 transform hover:scale-105 transition-all duration-200 shadow-2xl border-2 border-purple-400/40 hover:border-purple-300/60 hover:shadow-purple-500/25"
                >
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <span>Leaderboard</span>
                  </div>
                </button>
              </div>
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
        <div className="relative min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex">
          {/* Full Screen Pulse Overlay */}
          {doorColor !== 'neutral' && currentAnalysis && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {/* Screen-wide pulse effect */}
              <div
                className={`absolute inset-0 ${
                  doorColor === 'green'
                    ? 'bg-green-500/10'
                    : doorColor === 'yellow'
                      ? 'bg-yellow-500/10'
                      : 'bg-red-500/10'
                } animate-pulse`}
                style={{ animationDuration: '1.5s' }}
              />

              {/* Score-specific full-screen effects */}
              {currentAnalysis.score >= 70 && (
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

              {currentAnalysis.score <= 30 && (
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
          {/* LEFT SIDE - Map and Info */}
          <div className="w-1/2 p-4 flex flex-col h-screen">
            {/* TOP LEFT - Compact Info Section (20% height) */}
            <div className="mb-4 space-y-3" style={{ height: '20%' }}>
              <button
                onClick={handleBackToMenu}
                className="bg-black/40 backdrop-blur-lg text-white px-3 py-2 rounded-lg hover:bg-black/50 transition-colors border border-white/20 text-sm"
              >
                ← Menu
              </button>

              {/* Game Info - Compact */}
              <div className="bg-black/40 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                <h3 className="text-white font-semibold mb-2 text-sm">🎮 Game Info</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Door:</span>
                    <span className="text-white">
                      {gamePath.currentPosition + 1}/{gamePath.totalLength}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Time:</span>
                    <span className="text-white">{timeLeft}s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN - Big Minimap (80% height) */}
            <div className="flex-1" style={{ height: '80%' }}>
              <GameMinimap gamePath={gamePath} className="h-full" />
            </div>
          </div>

          {/* RIGHT SIDE - Big Door */}
          <div className="w-1/2 p-4 flex items-center justify-center">
            <div className="relative w-full h-full max-h-[90vh]">
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
                  className={`absolute inset-0 rounded-3xl transition-all duration-1000 pointer-events-none ${
                    doorColor === 'red'
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
                      className={`absolute inset-4 rounded-3xl border-4 ${
                        doorColor === 'green'
                          ? 'border-green-400/60 animate-ping'
                          : doorColor === 'yellow'
                            ? 'border-yellow-400/60 animate-ping'
                            : 'border-red-400/60 animate-ping'
                      }`}
                      style={{ animationDuration: '2s' }}
                    ></div>
                    
                    {/* Pulse Ring 2 - Middle */}
                    <div
                      className={`absolute inset-2 rounded-3xl border-2 ${
                        doorColor === 'green'
                          ? 'border-green-300/40 animate-ping'
                          : doorColor === 'yellow'
                            ? 'border-yellow-300/40 animate-ping'
                            : 'border-red-300/40 animate-ping'
                      }`}
                      style={{ animationDuration: '2.5s', animationDelay: '0.3s' }}
                    ></div>
                    
                    {/* Pulse Ring 3 - Outer */}
                    <div
                      className={`absolute -inset-2 rounded-3xl border ${
                        doorColor === 'green'
                          ? 'border-green-200/30 animate-ping'
                          : doorColor === 'yellow'
                            ? 'border-yellow-200/30 animate-ping'
                            : 'border-red-200/30 animate-ping'
                      }`}
                      style={{ animationDuration: '3s', animationDelay: '0.6s' }}
                    ></div>

                    {/* Score-based Particle Effects */}
                    {currentAnalysis.score >= 70 && (
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

                    {currentAnalysis.score <= 30 && (
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
                <div className="absolute inset-6 lg:inset-12 flex flex-col z-10 pointer-events-auto">
                  {/* Door Status Indicator and Analysis */}
                  {showOutcome && currentAnalysis && (
                    <div className="mb-4 lg:mb-6 text-center">
                      <div
                        className={`inline-block px-4 lg:px-6 py-2 lg:py-3 rounded-full text-white font-bold text-lg lg:text-xl backdrop-blur-lg border-2 mb-4 ${
                          currentAnalysis.total_score >= CONFIG.SCORING.GOOD_THRESHOLD
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

                      {/* AI Response */}
                      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 lg:p-6 border border-white/30 mb-4 animate-slide-in-up">
                        <h3 className="text-lg lg:text-xl font-bold text-white mb-3 flex items-center gap-2">
                          🤖 <span>AI Response</span>
                        </h3>

                        {currentAnalysis.feedback && (
                          <div className="p-4 bg-black/20 rounded-lg">
                            <div className="text-white text-base lg:text-lg leading-relaxed">
                              {currentAnalysis.feedback}
                            </div>
                          </div>
                        )}

                        {/* Next Button */}
                        {waitingForNext && (
                          <div className="text-center">
                            <button
                              onClick={handleNextScenario}
                              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg animate-pulse"
                            >
                              Continue to Next Door →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scenario Section - Top of Door */}
                  <div className="mb-4 lg:mb-8">
                    <div className="bg-black/30 backdrop-blur-lg rounded-xl p-4 lg:p-6 border border-white/20">
                      <h2 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center gap-3">
                        📖 <span>Current Scenario</span>
                      </h2>
                      {currentScenario ? (
                        <p className="text-gray-100 text-base lg:text-lg leading-relaxed">
                          {currentScenario.content}
                        </p>
                      ) : (
                        <div className="flex items-center gap-3 text-gray-300">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          <span className="text-lg">Loading scenario...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Response Input Section - Bottom of Door */}
                  <div className="flex-1 flex flex-col justify-end">
                    <div className="bg-black/30 backdrop-blur-lg rounded-xl p-4 lg:p-6 border border-white/20">
                      <h3 className="text-lg lg:text-xl font-bold text-white mb-4 flex items-center gap-3">
                        💭 <span>Your Response</span>
                      </h3>

                      <VoiceResponseInput
                        onSubmit={handleSubmitResponse}
                        timeLeft={timeLeft}
                        maxLength={CONFIG.GAME.MAX_RESPONSE_LENGTH}
                        placeholder="Describe what you would do in this situation..."
                        disabled={isSubmitting || !currentScenario || waitingForNext}
                        autoFocus={true}
                      />
                    </div>
                  </div>
                </div>

                {/* Processing Overlay */}
                {isSubmitting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-3xl z-10">
                    <div className="text-center text-white bg-black/70 backdrop-blur-lg rounded-2xl p-6 lg:p-8 border border-white/30 mx-4">
                      <div className="animate-spin rounded-full h-16 lg:h-20 w-16 lg:w-20 border-b-4 border-white mx-auto mb-4 lg:mb-6"></div>
                      <div className="text-xl lg:text-2xl font-bold mb-2">
                        AI is analyzing your response...
                      </div>
                      <div className="text-gray-300 text-base lg:text-lg">
                        This may take a moment
                      </div>
                    </div>
                  </div>
                )}

                {/* Door Glow Effect */}
                <div
                  className={`absolute inset-0 rounded-3xl transition-all duration-1000 ${
                    doorColor === 'red'
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

  return null;
};
