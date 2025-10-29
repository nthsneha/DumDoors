import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort, settings } from '@devvit/web/server';
import { createPost } from './core/post';

// Backend URL - Using Cloudflare Tunnel with custom domain
const BACKEND_URL = 'https://api.dumdoors.tech';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

// API Configuration endpoint (without sensitive data)
router.get('/api/config', async (_req, res): Promise<void> => {
  try {
    const [environment, gameMode, difficultyLevel, maxResponseLength] = await Promise.all([
      settings.get('environment'),
      settings.get('gameMode'),
      settings.get('difficultyLevel'),
      settings.get('maxResponseLength'),
    ]);

    res.json({
      environment: environment || 'development',
      gameMode: gameMode || 'single',
      difficultyLevel: difficultyLevel || 'medium',
      maxResponseLength: maxResponseLength || 500,
    });
  } catch (error) {
    console.error('Error fetching app configuration:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch app configuration',
    });
  }
});

// Gemini AI Analysis endpoint (server-side only)
router.post('/api/analyze', async (req, res): Promise<void> => {
  try {
    const { scenario, userResponse, existingReasoning } = req.body;

    if (!scenario || !userResponse) {
      res.status(400).json({
        status: 'error',
        message: 'Scenario and userResponse are required',
      });
      return;
    }

    const geminiApiKey = await settings.get('geminiApiKey');
    if (!geminiApiKey) {
      res.status(500).json({
        status: 'error',
        message: 'Gemini API key not configured',
      });
      return;
    }

    const prompt = `
You are the ultimate AI judge for "DumDoors" - the most hilariously brutal problem-solving game show in existence! Your job is to analyze responses to absurd life scenarios and deliver EXAGGERATED, OVER-THE-TOP outcomes that are both funny and brutally honest.

🎭 THE SCENARIO:
${scenario}

🎯 PLAYER'S RESPONSE:
"${userResponse}"

${existingReasoning ? `📚 REFERENCE CONTEXT (for inspiration): ${existingReasoning}` : ''}

🎪 YOUR MISSION:
You need to score this response and create an ABSOLUTELY EXAGGERATED outcome that's both hilarious and reflects the quality of their solution.

📊 SCORING SYSTEM (be harsh but fair):
- 90-100: LEGENDARY - This person is a genius who could solve world hunger with a paperclip
- 70-89: EXCELLENT - Smart, creative, would probably work in real life
- 50-69: DECENT - Not terrible, but not winning any awards either
- 30-49: POOR - This might actually make things worse, but at least they tried
- 0-29: CATASTROPHIC - This person should not be allowed to make decisions

🎨 OUTCOME REQUIREMENTS:
- If score is 70+: Create a WILDLY POSITIVE, over-the-top success story
- If score is 30-69: Create a MODERATELY CHAOTIC but survivable outcome
- If score is 0-29: Create an ABSOLUTELY DISASTROUS, hilariously bad outcome

Make the outcome:
- ONE PARAGRAPH ONLY (3-5 sentences max)
- ABSURDLY exaggerated but concise
- GENUINELY funny
- Include one or two unexpected consequences
- Use vivid, colorful language
- Make it punchy and memorable

Think like you're writing a hilarious tweet or short comedy bit. Keep it SHORT but FUNNY!

Format as JSON:
{
  "score": [0-100],
  "outcome": "[One entertaining paragraph - SHORT, PUNCHY, and HILARIOUS]"
}

Remember: The outcome should be a direct consequence of THEIR specific response, not a generic result. Make it personal to what they actually said!
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 1,
          topP: 1,
          maxOutputTokens: 4000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error details:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);

    // Extract text from response
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      text = data.candidates?.[0]?.text;
    }

    if (!text) {
      throw new Error('No response from Gemini');
    }

    // Extract JSON from the response
    let cleanText = text;
    if (text.includes('```json')) {
      cleanText = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (text.includes('```')) {
      cleanText = text.replace(/```\s*/g, '');
    }

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini');
    }

    let analysis;
    try {
      let jsonString = jsonMatch[0];
      if (!jsonString.endsWith('}')) {
        const openBraces = (jsonString.match(/\{/g) || []).length;
        const closeBraces = (jsonString.match(/\}/g) || []).length;
        for (let i = 0; i < openBraces - closeBraces; i++) {
          jsonString += '}';
        }
      }
      analysis = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error('Failed to parse JSON response from Gemini');
    }

    // Determine color based on score
    let color: 'red' | 'yellow' | 'green';
    if (analysis.score >= 70) color = 'green';
    else if (analysis.score >= 40) color = 'yellow';
    else color = 'red';

    res.json({
      score: analysis.score,
      color,
      outcome: analysis.outcome,
    });

  } catch (error) {
    console.error('Gemini analysis error:', error);

    // Enhanced fallback response
    const { userResponse } = req.body;
    const responseLength = userResponse?.length || 0;
    const hasCreativeWords = /creative|innovative|clever|smart|think|plan|strategy/i.test(userResponse || '');
    const hasActionWords = /would|will|should|could|try|attempt|do|go|run/i.test(userResponse || '');

    let fallbackScore = 45;
    if (responseLength > 100) fallbackScore += 15;
    if (responseLength > 200) fallbackScore += 10;
    if (hasCreativeWords) fallbackScore += 15;
    if (hasActionWords) fallbackScore += 10;

    fallbackScore = Math.min(85, Math.max(25, fallbackScore));

    let fallbackColor: 'red' | 'yellow' | 'green';
    if (fallbackScore >= 70) fallbackColor = 'green';
    else if (fallbackScore >= 40) fallbackColor = 'yellow';
    else fallbackColor = 'red';

    const outcomes = {
      high: "🎉 INCREDIBLE! Your brilliant response triggers a chain reaction of pure genius that somehow involves a confused pigeon starting a revolution, three office staplers forming a union, and a very judgmental houseplant writing a surprisingly insightful Yelp review. Time travelers from the future come back just to witness this moment of intellectual beauty!",
      medium: "🎭 Your response creates a wonderfully chaotic butterfly effect where a nearby pigeon becomes inspired to reorganize the local parking lot while seventeen staplers demand better working conditions. This all leads to you being featured in a documentary where David Attenborough narrates your life decisions with the same dramatic flair he uses for nature's most bizarre mating rituals.",
      low: "💥 OH NO! Your response creates a spectacular disaster involving a runaway shopping cart, seventeen confused pigeons, and a very angry squirrel who somehow reorganizes the entire neighborhood. The local news covers it as 'The Great Tuesday Incident' and your response becomes a cautionary tale in emergency response training seminars!"
    };

    res.json({
      score: fallbackScore,
      color: fallbackColor,
      outcome: fallbackScore >= 70 ? outcomes.high : fallbackScore >= 40 ? outcomes.medium : outcomes.low
    });
  }
});

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Proxy middleware for game API calls to backend
router.all('/api/game/:gameId', async (req, res): Promise<void> => {
  try {
    const backendPath = req.path.replace('/api', '');
    const backendUrl = `${BACKEND_URL}/api${backendPath}`;
    
    console.log(`Proxying ${req.method} ${req.path} to ${backendUrl}`);
    
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok browser warning
      },
    };
    
    if (req.method !== 'GET' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(backendUrl, fetchOptions);
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Proxy error for ${req.path}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Backend service unavailable',
    });
  }
});

// Proxy middleware for leaderboard API calls
router.get('/api/leaderboard', async (req, res): Promise<void> => {
  try {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const backendUrl = `${BACKEND_URL}${req.path}${queryString}`;
    
    console.log(`Proxying ${req.method} ${req.path} to ${backendUrl}`);
    
    const response = await fetch(backendUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Proxy error for ${req.path}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Backend service unavailable',
    });
  }
});

// Leaderboard stats endpoint
router.get('/api/leaderboard/stats', async (req, res): Promise<void> => {
  try {
    const backendUrl = `${BACKEND_URL}${req.path}`;
    
    console.log(`Proxying ${req.method} ${req.path} to ${backendUrl}`);
    
    const response = await fetch(backendUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Proxy error for ${req.path}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Backend service unavailable',
    });
  }
});

// Proxy middleware for error reporting
router.post('/api/errors', async (req, res): Promise<void> => {
  try {
    const backendUrl = `${BACKEND_URL}${req.path}`;
    
    const response = await fetch(backendUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Proxy error for ${req.path}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Backend service unavailable',
    });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
