interface ScenarioAnalysis {
  score: number;
  color: 'red' | 'yellow' | 'green';
  outcome: string;
}

interface AppConfig {
  environment: string;
  gameMode: string;
  difficultyLevel: string;
  maxResponseLength: number;
}

class GeminiService {
  private configPromise: Promise<AppConfig> | null = null;

  private async getConfig(): Promise<AppConfig> {
    if (!this.configPromise) {
      this.configPromise = fetch('/api/config').then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch app configuration');
        }
        return response.json();
      }).catch(error => {
        console.error('Failed to fetch config, using defaults:', error);
        return {
          environment: 'development',
          gameMode: 'single',
          difficultyLevel: 'medium',
          maxResponseLength: 500,
        };
      });
    }
    return this.configPromise;
  }

  async analyzeResponse(scenario: string, userResponse: string, existingReasoning?: string): Promise<ScenarioAnalysis> {
    try {
      console.log('🔍 [DEBUG] Making request to server-side Gemini analysis endpoint');
      console.log('🔍 [DEBUG] Request data:', { scenario, userResponse, existingReasoning });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario,
          userResponse,
          existingReasoning,
        }),
      });

      console.log('🔍 [DEBUG] Response status:', response.status);
      console.log('🔍 [DEBUG] Response ok:', response.ok);

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const responseText = await response.text();
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            errorMessage = responseText || errorMessage;
          }
        } catch (textError) {
          console.warn('Failed to read error response:', textError);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const analysis = await response.json();
      console.log('🔍 [DEBUG] Server analysis response:', analysis);
      console.log('🔍 [DEBUG] Analysis type:', typeof analysis);
      console.log('🔍 [DEBUG] Analysis keys:', Object.keys(analysis));

      // Check if this is a fallback response with debug info
      if (analysis._debug) {
        console.log('🚨 [DEBUG] SERVER ERROR DETAILS:', analysis._debug);
        console.log('🚨 [DEBUG] This is a FALLBACK response, not real AI!');
        console.log('🚨 [DEBUG] Server error:', analysis._debug.error);
        console.log('🚨 [DEBUG] Error time:', analysis._debug.timestamp);
      }

      if (!analysis.score || !analysis.color || !analysis.outcome) {
        console.log('🚨 [DEBUG] Missing required fields in analysis response');
        throw new Error('Invalid analysis response structure');
      }

      if (analysis._debug) {
        console.log('⚠️ [DEBUG] Using fallback response due to server error');
      } else {
        console.log('✅ [DEBUG] Successfully got REAL Gemini response');
      }
      
      return {
        score: analysis.score,
        color: analysis.color,
        outcome: analysis.outcome,
      };
    } catch (error) {
      console.error('🚨 [DEBUG] Server-side Gemini analysis error:', error);
      console.log('🚨 [DEBUG] Falling back to local scoring');

      // Enhanced fallback response based on response length and keywords
      const responseLength = userResponse.length;
      const hasCreativeWords = /creative|innovative|clever|smart|think|plan|strategy/i.test(userResponse);
      const hasActionWords = /would|will|should|could|try|attempt|do|go|run/i.test(userResponse);

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

      return {
        score: fallbackScore,
        color: fallbackColor,
        outcome: fallbackScore >= 70 ? outcomes.high : fallbackScore >= 40 ? outcomes.medium : outcomes.low
      };
    }
  }
}

export const geminiService = new GeminiService();
export type { ScenarioAnalysis };