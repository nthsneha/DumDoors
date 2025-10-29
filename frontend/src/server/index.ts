import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort, settings } from '@devvit/web/server';
import { createPost } from './core/post';
import { createSplashScreen } from './core/splash';
import { leaderboardService } from './services/leaderboardService';
import { redditIntegrationService } from './services/redditIntegrationService';

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

// Splash screen endpoint
router.get('/splash', async (_req, res): Promise<void> => {
  try {
    const splashHtml = createSplashScreen();
    res.setHeader('Content-Type', 'text/html');
    res.send(splashHtml);
  } catch (error) {
    console.error('Splash screen error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate splash screen',
    });
  }
});

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
    console.log('🔍 [SERVER DEBUG] Received analyze request');
    const { scenario, userResponse, existingReasoning } = req.body;
    console.log('🔍 [SERVER DEBUG] Request body:', { scenario: scenario?.substring(0, 100), userResponse: userResponse?.substring(0, 100), existingReasoning });

    if (!scenario || !userResponse) {
      console.log('🚨 [SERVER DEBUG] Missing required fields');
      res.status(400).json({
        status: 'error',
        message: 'Scenario and userResponse are required',
      });
      return;
    }

    const geminiApiKey = await settings.get('geminiApiKey');
    console.log('🔍 [SERVER DEBUG] API key available:', !!geminiApiKey);
    if (!geminiApiKey) {
      console.log('🚨 [SERVER DEBUG] No Gemini API key configured');
      res.status(500).json({
        status: 'error',
        message: 'Gemini API key not configured',
      });
      return;
    }

    const prompt = `You are an AI judge for "DumDoors" - a hilarious decision-making game. Analyze this response and create a funny, exaggerated outcome.

SCENARIO: ${scenario}
PLAYER RESPONSE: "${userResponse}"
${existingReasoning ? `CONTEXT: ${existingReasoning}` : ''}

SCORING (0-100):
- 90-100: Brilliant, genius-level response
- 70-89: Smart, creative, would work well
- 50-69: Decent response, not bad
- 30-49: Poor choice, might cause problems
- 0-29: Terrible decision, disaster incoming

Create a SHORT but HILARIOUS outcome (2-3 sentences) that directly results from their specific response. Make it funny and exaggerated but not mean.

Respond with ONLY this JSON:
{
  "score": [number 0-100],
  "outcome": "[Funny 2-3 sentence result of their choice]"
}`;

    // Try multiple models with retry logic
    const models = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite'
    ];

    let response;
    let lastError;

    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const model = models[modelIndex];
      console.log(`🔍 [SERVER DEBUG] Trying model: ${model}`);

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
          console.log(`🔍 [SERVER DEBUG] Attempt ${attempt}/3 with ${model}`);

          // Create a timeout controller for faster requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

          response = await fetch(geminiUrl, {
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
                temperature: 0.7,
                topK: 20,
                topP: 0.8,
                maxOutputTokens: 4096, // Increased for complete responses
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          console.log(`🔍 [SERVER DEBUG] ${model} response status:`, response.status);

          if (response.ok) {
            console.log(`✅ [SERVER DEBUG] Success with ${model} on attempt ${attempt}`);
            break;
          } else {
            const errorText = await response.text();
            console.log(`🚨 [SERVER DEBUG] ${model} attempt ${attempt} failed:`, errorText);

            // Check if it's a 503 overload error
            if (response.status === 503 || errorText.includes('overloaded')) {
              console.log(`⏳ [SERVER DEBUG] Model overloaded, waiting before retry...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
              continue;
            } else {
              // Non-retryable error, try next model
              lastError = new Error(`${model}: ${response.status} - ${errorText}`);
              break;
            }
          }
        } catch (fetchError) {
          console.log(`🚨 [SERVER DEBUG] ${model} attempt ${attempt} fetch error:`, fetchError);
          lastError = fetchError;

          // Check if it's a timeout/abort error
          if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))) {
            console.log(`⏰ [SERVER DEBUG] Request timed out, trying next attempt/model`);
          }

          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Shorter delay
          }
        }
      }

      if (response && response.ok) {
        break; // Success, exit model loop
      }
    }

    if (!response || !response.ok) {
      console.error('🚨 [SERVER DEBUG] All models failed, last error:', lastError);
      throw lastError || new Error('All Gemini models failed');
    }

    const data = await response.json() as any;
    console.log('🔍 [SERVER DEBUG] Gemini API response:', JSON.stringify(data, null, 2));

    // Extract text from response
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('🔍 [SERVER DEBUG] Extracted text:', text);

    // Check for token limit issues
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      console.log('🚨 [SERVER DEBUG] Response was cut off due to token limit');
      throw new Error('Response truncated due to token limit');
    }

    if (!text) {
      console.log('🚨 [SERVER DEBUG] No text in response, finish reason:', finishReason);
      throw new Error(`No text generated, finish reason: ${finishReason}`);
    }

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

    const finalResponse = {
      score: analysis.score,
      color,
      outcome: analysis.outcome,
    };

    console.log('✅ [SERVER DEBUG] Sending successful Gemini response:', finalResponse);
    res.json(finalResponse);

  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Gemini analysis error:', error);
    console.log('🚨 [SERVER DEBUG] Using fallback response');

    // Enhanced fallback response
    const { userResponse } = req.body;

    // Add debug info to response for client-side debugging
    const errorInfo = {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      endpoint: '/api/analyze'
    };
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

    const fallbackResponse = {
      score: fallbackScore,
      color: fallbackColor,
      outcome: fallbackScore >= 70 ? outcomes.high : fallbackScore >= 40 ? outcomes.medium : outcomes.low,
      _debug: errorInfo // Add debug info for client
    };

    console.log('🚨 [SERVER DEBUG] Sending fallback response:', fallbackResponse);
    res.json(fallbackResponse);
  }
});

// Dum-Stones AI Analysis endpoint (server-side only)
router.post('/api/dumstones', async (req, res): Promise<void> => {
  try {
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Responses array is required and cannot be empty',
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

    const averageScore = responses.reduce((sum: number, r: any) => sum + r.score, 0) / responses.length;
    const responseData = responses.map((r: any, i: number) =>
      `Scenario ${i + 1}: "${r.scenario}"\nPlayer Response: "${r.response}"\nScore: ${r.score}/100\n`
    ).join('\n');

    const prompt = `You are a sassy AI personality analyst for "DumDoors". Create a hilarious roasting personality report based on the player's game responses.

PLAYER DATA:
Total Responses: ${responses.length}
Average Score: ${Math.round(averageScore)}/100

THEIR RESPONSES:
${responseData}

Create a funny, roasting personality report. Be witty and entertaining but not cruel. Reference their actual responses when possible.

Respond with ONLY this JSON:
{
  "title": "A funny personality type name (e.g. 'The Chaos Goblin')",
  "personality": "Short personality description",
  "roast": "A hilarious 2-3 sentence roast of their decision-making style",
  "strengths": ["3-4 funny strengths based on their responses"],
  "weaknesses": ["3-4 funny weaknesses based on their responses"], 
  "funnyQuote": "A fake quote that sounds like something they'd say",
  "overallGrade": "Letter grade with funny descriptor (e.g. 'B+ (For Effort)')",
  "emoji": "One emoji that represents them"
}`;

    // Try multiple models with retry logic for Dum-Stones
    const models = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite'
    ];

    let response;
    let lastError;

    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const model = models[modelIndex];
      console.log(`🔍 [SERVER DEBUG] Dum-Stones trying model: ${model}`);

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
          console.log(`🔍 [SERVER DEBUG] Dum-Stones attempt ${attempt}/3 with ${model}`);

          // Create a timeout controller for faster requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

          response = await fetch(geminiUrl, {
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
                temperature: 0.8,
                topK: 20,
                topP: 0.8,
                maxOutputTokens: 6096, // Increased for complete personality reports
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          console.log(`🔍 [SERVER DEBUG] Dum-Stones ${model} response status:`, response.status);

          if (response.ok) {
            console.log(`✅ [SERVER DEBUG] Dum-Stones success with ${model} on attempt ${attempt}`);
            break;
          } else {
            const errorText = await response.text();
            console.log(`🚨 [SERVER DEBUG] Dum-Stones ${model} attempt ${attempt} failed:`, errorText);

            // Check if it's a 503 overload error
            if (response.status === 503 || errorText.includes('overloaded')) {
              console.log(`⏳ [SERVER DEBUG] Dum-Stones model overloaded, waiting before retry...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue;
            } else {
              lastError = new Error(`${model}: ${response.status} - ${errorText}`);
              break;
            }
          }
        } catch (fetchError) {
          console.log(`🚨 [SERVER DEBUG] Dum-Stones ${model} attempt ${attempt} fetch error:`, fetchError);
          lastError = fetchError;

          // Check if it's a timeout/abort error
          if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))) {
            console.log(`⏰ [SERVER DEBUG] Dum-Stones request timed out, trying next attempt/model`);
          }

          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Shorter delay
          }
        }
      }

      if (response && response.ok) {
        break;
      }
    }

    if (!response || !response.ok) {
      console.error('🚨 [SERVER DEBUG] All Dum-Stones models failed, last error:', lastError);
      throw lastError || new Error('All Gemini models failed for Dum-Stones');
    }

    const data = await response.json() as any;
    console.log('Gemini API response for Dum-Stones:', data);

    // Extract text from response
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    // Check for token limit issues
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      console.log('🚨 [SERVER DEBUG] Dum-Stones response was cut off due to token limit');
      throw new Error('Dum-Stones response truncated due to token limit');
    }

    if (!text) {
      text = data.candidates?.[0]?.text;
    }

    if (!text) {
      console.log('🚨 [SERVER DEBUG] No text in Dum-Stones response, finish reason:', finishReason);
      throw new Error(`No Dum-Stones text generated, finish reason: ${finishReason}`);
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

    let report;
    try {
      let jsonString = jsonMatch[0];
      if (!jsonString.endsWith('}')) {
        const openBraces = (jsonString.match(/\{/g) || []).length;
        const closeBraces = (jsonString.match(/\}/g) || []).length;
        for (let i = 0; i < openBraces - closeBraces; i++) {
          jsonString += '}';
        }
      }
      report = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error('Failed to parse JSON response from Gemini');
    }

    res.json(report);

  } catch (error) {
    console.error('Dum-Stones analysis error:', error);

    // Enhanced fallback response
    const { responses } = req.body;
    const averageScore = responses?.reduce((sum: number, r: any) => sum + r.score, 0) / responses?.length || 50;

    // Analyze response patterns for better fallback
    const responseTexts = responses?.map((r: any) => r.response.toLowerCase()) || [];
    const isAggressive = responseTexts.some((r: string) =>
      r.includes('fight') || r.includes('attack') || r.includes('punch') || r.includes('hit')
    );
    const isPassive = responseTexts.some((r: string) =>
      r.includes('run') || r.includes('hide') || r.includes('avoid') || r.includes('escape')
    );
    const isCreative = responseTexts.some((r: string) =>
      r.includes('creative') || r.includes('think') || r.includes('plan') || r.includes('idea')
    );

    let fallbackReport;
    if (averageScore >= 80) {
      fallbackReport = {
        title: "The Overachiever Supreme",
        personality: "Annoyingly Perfect Human",
        roast: "You're that person who not only reads the instruction manual but highlights it and takes notes. Your responses are so methodical, they make spreadsheets jealous.",
        strengths: ["Strategic planning", "Rule following", "Making others feel inadequate", "Color-coded calendars"],
        weaknesses: ["Fun", "Spontaneity", "Accepting chaos", "Relaxing ever"],
        funnyQuote: "I don't just think outside the box, I optimize the box's efficiency ratings first.",
        overallGrade: "A+ (Teacher's Pet Extraordinaire)",
        emoji: "🤓"
      };
    } else if (averageScore >= 60) {
      if (isCreative) {
        fallbackReport = {
          title: "The Creative Chaos",
          personality: "Beautifully Unpredictable",
          roast: "Your brain works like a GPS that takes scenic routes through dimensions. Your solutions are either genius or completely insane.",
          strengths: ["Outside-the-box thinking", "Entertainment value", "Keeping things interesting", "Making simple things complicated"],
          weaknesses: ["Conventional logic", "Simple solutions", "Following instructions", "Being predictable"],
          funnyQuote: "Why take the easy path when you can build a catapult?",
          overallGrade: "B+ (For Creativity)",
          emoji: "🎨"
        };
      } else {
        fallbackReport = {
          title: "The Solid Citizen",
          personality: "Reliably Average",
          roast: "You're the human equivalent of vanilla ice cream - not bad, but nobody's getting excited. Your responses are sensible and thrilling as watching paint dry.",
          strengths: ["Common sense", "Reliability", "Not making things worse", "Being the voice of reason"],
          weaknesses: ["Excitement", "Risk-taking", "Standing out", "Being memorable"],
          funnyQuote: "I don't always play it safe, but when I do, I really do.",
          overallGrade: "B (Solid B)",
          emoji: "😐"
        };
      }
    } else if (averageScore >= 40) {
      if (isAggressive) {
        fallbackReport = {
          title: "The Chaos Goblin",
          personality: "Violence is Always an Option",
          roast: "Your solution to every problem is apparently 'punch it.' Locked door? Punch it. Difficult conversation? Punch it. Math homework? Also punch it.",
          strengths: ["Directness", "Confidence", "Intimidation factor", "Solving problems with enthusiasm"],
          weaknesses: ["Subtlety", "Diplomacy", "Not getting arrested", "Indoor voice"],
          funnyQuote: "I don't have anger issues, I have anger solutions!",
          overallGrade: "C- (Concerning)",
          emoji: "😤"
        };
      } else if (isPassive) {
        fallbackReport = {
          title: "The Professional Runner",
          personality: "Strategic Retreat Specialist",
          roast: "Your fight-or-flight response is permanently stuck on 'flight.' You've turned avoiding problems into an art form.",
          strengths: ["Self-preservation", "Cardio fitness", "Knowing your limits", "Exit strategy planning"],
          weaknesses: ["Confrontation", "Standing your ground", "Helping others", "Staying put"],
          funnyQuote: "I'm not running away, I'm advancing in the opposite direction!",
          overallGrade: "C (Could do better)",
          emoji: "🏃‍♂️"
        };
      } else {
        fallbackReport = {
          title: "The Confused Wanderer",
          personality: "Perpetually Lost",
          roast: "You approach problems like a tourist without a map - lots of wandering, occasional panic, and somehow ending up further from your destination.",
          strengths: ["Optimism", "Persistence", "Entertainment value", "Making others feel smarter"],
          weaknesses: ["Direction", "Focus", "Understanding the assignment", "GPS skills"],
          funnyQuote: "I may not know where I'm going, but I'm making great time!",
          overallGrade: "C- (Participation trophy)",
          emoji: "🤷‍♂️"
        };
      }
    } else {
      fallbackReport = {
        title: "The Magnificent Disaster",
        personality: "Chaos Incarnate",
        roast: "You've turned poor decision-making into an art form. Your responses are so spectacularly wrong, they're almost impressive.",
        strengths: ["Unpredictability", "Comic relief", "Making everyone else feel smarter", "Commitment to chaos"],
        weaknesses: ["Logic", "Common sense", "Basic survival instincts", "Learning from anything"],
        funnyQuote: "I don't always make terrible decisions, but when I do, I make them spectacularly.",
        overallGrade: "D (For Dedication to Disaster)",
        emoji: "💥"
      };
    }

    res.json(fallbackReport);
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

// Leaderboard API endpoints
router.get('/api/leaderboard', async (req, res): Promise<void> => {
  try {
    console.log('🏆 [SERVER DEBUG] Getting leaderboard with query:', req.query);
    
    const gameMode = req.query.gameMode as any;
    const theme = req.query.theme as string;
    const timeRange = (req.query.timeRange as any) || 'all';
    const limit = parseInt(req.query.limit as string) || 10;

    const leaderboard = await leaderboardService.getGlobalLeaderboard(
      gameMode,
      theme,
      timeRange,
      limit
    );

    console.log('✅ [SERVER DEBUG] Leaderboard retrieved successfully');
    res.json(leaderboard);
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Leaderboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get leaderboard data',
    });
  }
});

// Leaderboard stats endpoint
router.get('/api/leaderboard/stats', async (req, res): Promise<void> => {
  try {
    console.log('📊 [SERVER DEBUG] Getting leaderboard stats');
    
    const stats = await leaderboardService.getLeaderboardStats();
    
    console.log('✅ [SERVER DEBUG] Stats retrieved successfully');
    res.json(stats);
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get leaderboard stats',
    });
  }
});

// Submit game results to leaderboard
router.post('/api/leaderboard/submit', async (req, res): Promise<void> => {
  try {
    console.log('🎮 [SERVER DEBUG] Submitting game result to leaderboard');
    
    const { gameResults } = req.body;
    
    if (!gameResults) {
      res.status(400).json({
        status: 'error',
        message: 'Game results are required',
      });
      return;
    }

    // Get current Reddit user ID if available
    let redditUserId;
    try {
      const currentUser = await reddit.getCurrentUser();
      redditUserId = currentUser?.id;
    } catch (error) {
      console.warn('Could not get current Reddit user:', error);
    }

    await leaderboardService.submitGameResult(gameResults, redditUserId);
    
    console.log('✅ [SERVER DEBUG] Game result submitted successfully');
    res.json({
      status: 'success',
      message: 'Game result submitted to leaderboard',
    });
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Submit game result error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit game result',
    });
  }
});

// Get user's personal stats
router.get('/api/leaderboard/user/:userId', async (req, res): Promise<void> => {
  try {
    console.log('👤 [SERVER DEBUG] Getting user stats for:', req.params.userId);
    
    const userId = req.params.userId;
    const userStats = await leaderboardService.getUserStats(userId);
    
    console.log('✅ [SERVER DEBUG] User stats retrieved successfully');
    res.json(userStats);
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] User stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user stats',
    });
  }
});

// Get daily leaderboard for Reddit integration
router.get('/api/leaderboard/daily/:date', async (req, res): Promise<void> => {
  try {
    const date = req.params.date;
    console.log('📅 [SERVER DEBUG] Getting daily leaderboard for:', date);
    
    const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(date);
    
    console.log('✅ [SERVER DEBUG] Daily leaderboard retrieved successfully');
    res.json(dailyLeaderboard);
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Daily leaderboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get daily leaderboard',
    });
  }
});

// Get daily leaderboard for today (no date parameter)
router.get('/api/leaderboard/daily', async (req, res): Promise<void> => {
  try {
    console.log('📅 [SERVER DEBUG] Getting daily leaderboard for today');
    
    const dailyLeaderboard = await leaderboardService.getDailyLeaderboard();
    
    console.log('✅ [SERVER DEBUG] Daily leaderboard retrieved successfully');
    res.json(dailyLeaderboard);
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Daily leaderboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get daily leaderboard',
    });
  }
});

// Reddit Integration endpoints
router.post('/api/reddit/daily-leaderboard', async (req, res): Promise<void> => {
  try {
    console.log('📅 [SERVER DEBUG] Posting daily leaderboard to Reddit');
    
    const { date } = req.body;
    const postId = await redditIntegrationService.postDailyLeaderboard(date);
    
    if (postId) {
      console.log('✅ [SERVER DEBUG] Daily leaderboard posted successfully');
      res.json({
        status: 'success',
        postId,
        message: 'Daily leaderboard posted to Reddit',
      });
    } else {
      res.json({
        status: 'info',
        message: 'No games played today, no post created',
      });
    }
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Daily leaderboard post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to post daily leaderboard',
    });
  }
});

router.post('/api/reddit/weekly-leaderboard', async (req, res): Promise<void> => {
  try {
    console.log('📊 [SERVER DEBUG] Posting weekly leaderboard to Reddit');
    
    const postId = await redditIntegrationService.postWeeklyLeaderboard();
    
    if (postId) {
      console.log('✅ [SERVER DEBUG] Weekly leaderboard posted successfully');
      res.json({
        status: 'success',
        postId,
        message: 'Weekly leaderboard posted to Reddit',
      });
    } else {
      res.json({
        status: 'info',
        message: 'No games played this week, no post created',
      });
    }
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Weekly leaderboard post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to post weekly leaderboard',
    });
  }
});

router.get('/api/reddit/user/:username/stats', async (req, res): Promise<void> => {
  try {
    console.log('👤 [SERVER DEBUG] Getting Reddit user stats for:', req.params.username);
    
    const username = req.params.username;
    const userStats = await redditIntegrationService.getUserRedditStats(username);
    
    if (userStats) {
      console.log('✅ [SERVER DEBUG] Reddit user stats retrieved successfully');
      res.json(userStats);
    } else {
      res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Reddit user stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user stats',
    });
  }
});

router.post('/api/reddit/update-flair/:username', async (req, res): Promise<void> => {
  try {
    console.log('🏷️ [SERVER DEBUG] Updating flair for:', req.params.username);
    
    const username = req.params.username;
    await redditIntegrationService.updateUserFlair(username);
    
    console.log('✅ [SERVER DEBUG] User flair updated successfully');
    res.json({
      status: 'success',
      message: 'User flair updated',
    });
  } catch (error) {
    console.error('🚨 [SERVER DEBUG] Update flair error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user flair',
    });
  }
});

// Proxy middleware for error reporting
router.post('/api/errors', async (req, res): Promise<void> => {
  try {
    const backendUrl = `${BACKEND_URL}${req.path}`;

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
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

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
