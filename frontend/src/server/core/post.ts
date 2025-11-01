import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Enhanced Splash Screen Configuration
      appDisplayName: 'DumDoors - Multiplayer AI Party Game',
      backgroundUri: 'default-splash.png', // Keep same splash art
      buttonLabel: '🎮 Enter DumDoors',
      // description: '🤖 AI judges your terrible decisions • 🏁 Race friends in real-time • 🪦 Get your personalized DumStone roast!',
      entryUri: 'index.html',
      heading: 'Trick or Treat? Decide wisely ',
      appIconUri: 'default-icon.png',
    },
    postData: {
      gameState: 'menu', // Start in main menu
      version: '2.0', // Updated version with multiplayer
      features: ['multiplayer', 'singleplayer', 'dumstones', 'leaderboard'],
      playerId: null,
      sessionId: null,
      gameMode: 'menu', // Start at menu to choose mode
      createdAt: new Date().toISOString(),
      multiplayerEnabled: true,
      betaFeatures: ['live_multiplayer', 'real_time_racing'],
    },
    subredditName: subredditName,
    title: '🎃 DumDoors: Halloween edition - Halloween opens new doors  if you dare. ',
  });
};

// Create a special announcement post for the multiplayer update
export const createMultiplayerAnnouncementPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      appDisplayName: 'DumDoors 2.0 - Multiplayer Update!',
      backgroundUri: 'default-splash.png',
      buttonLabel: '🚀 Try Multiplayer Now!',
      description: '🎉 MAJOR UPDATE: Live multiplayer, real-time racing, enhanced AI, and personalized DumStones!',
      entryUri: 'index.html',
      heading: '🎮 The Multiplayer Update Is Here! 🎮',
      appIconUri: 'default-icon.png',
    },
    postData: {
      gameState: 'menu',
      version: '2.0',
      updateType: 'multiplayer_launch',
      features: ['live_multiplayer', 'real_time_racing', 'enhanced_ai', 'dumstones', 'leaderboard'],
      announcement: true,
      createdAt: new Date().toISOString(),
    },
    subredditName: subredditName,
    title: '🚀 MAJOR UPDATE: DumDoors 2.0 with LIVE MULTIPLAYER is here! Race friends, get AI roasted together! 🎮🪦',
  });
};

// Create a tournament/event post
export const createTournamentPost = async (tournamentName: string, description: string) => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      appDisplayName: `DumDoors Tournament: ${tournamentName}`,
      backgroundUri: 'default-splash.png',
      buttonLabel: '🏆 Join Tournament',
      description: `${description} • Compete for glory and the ultimate DumStone!`,
      entryUri: 'index.html',
      heading: `🏆 ${tournamentName} 🏆`,
      appIconUri: 'dumdoors-icon.png',
    },
    postData: {
      gameState: 'multiplayer_lobby',
      version: '2.0',
      eventType: 'tournament',
      tournamentName,
      description,
      features: ['tournament_mode', 'multiplayer', 'leaderboard'],
      createdAt: new Date().toISOString(),
    },
    subredditName: subredditName,
    title: `🏆 DumDoors Tournament: ${tournamentName} - Join the Ultimate Bad Decision Championship! 🎮`,
  });
};