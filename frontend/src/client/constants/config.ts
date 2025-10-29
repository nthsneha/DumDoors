// Configuration constants
export const CONFIG = {
  // Gemini AI API configuration (fallback - should be set via settings)
  GEMINI_API_KEY: '', // Will be loaded from settings
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',

  // Game configuration
  GAME: {
    DEFAULT_TIME_LIMIT: 40, // seconds
    MAX_RESPONSE_LENGTH: 500,
    DEFAULT_PATH_LENGTH: 3,
    MIN_PATH_LENGTH: 1,
    MAX_PATH_LENGTH: 5,
    THEMES: ['adventure', 'mystery', 'comedy', 'survival', 'workplace', 'social'],
  },

  // Scoring thresholds
  SCORING: {
    EXCELLENT_THRESHOLD: 80,
    GOOD_THRESHOLD: 60,
    POOR_THRESHOLD: 30,
    TERRIBLE_THRESHOLD: 15,
  },

  // AI Response configuration
  AI: {
    MAX_OUTPUT_TOKENS: 4000,
    TEMPERATURE: 0.9,
    TOP_K: 1,
    TOP_P: 1,
  }
} as const;