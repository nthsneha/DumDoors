import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Splash Screen Configuration - customize these for your game
      appDisplayName: 'DumDoors - AI Decision Game',
      backgroundUri: 'default-splash.png', // Add your custom splash background
      buttonLabel: 'Play DumDoors',
      description: 'Make terrible decisions, get roasted by AI, and compete with friends!',
      entryUri: 'index.html',
      heading: 'Ready to Make Some Bad Choices?',
      appIconUri: 'dumdoors-icon.png', // Add your custom app icon
    },
    postData: {
      gameState: 'lobby', // Start in lobby state
      score: 0,
      playerId: null,
      sessionId: null,
      gameMode: 'multiplayer', // or 'singleplayer'
      createdAt: new Date().toISOString(),
    },
    subredditName: subredditName,
    title: 'DumDoors - The AI Decision Game Where Bad Choices Lead to Comedy Gold!',
  });
};
