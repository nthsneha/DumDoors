export interface ScoreResponse {
  total_score: number;
  metrics: {
    creativity: number;
    feasibility: number;
    humor: number;
    originality: number;
    speed_bonus?: number;
  };
  feedback?: string;
  path_recommendation: 'shorter_path' | 'normal_path' | 'longer_path';
}

class ScoringService {
  scoreResponse(doorContent: string, response: string, responseTimeSeconds?: number): ScoreResponse {
    const responseLength = response.trim().length;
    const words = response.toLowerCase().split(/\s+/);
    
    // Base score from response length (longer responses generally get higher scores)
    let creativity = Math.min(100, (responseLength / 5) + Math.random() * 30);
    let feasibility = Math.min(100, 50 + Math.random() * 40);
    let humor = Math.min(100, Math.random() * 60);
    let originality = Math.min(100, (responseLength / 8) + Math.random() * 40);

    // Bonus points for creative keywords
    const creativeWords = ['creative', 'innovative', 'unique', 'clever', 'brilliant', 'genius'];
    const actionWords = ['run', 'hide', 'fight', 'escape', 'plan', 'strategy', 'think'];
    const funnyWords = ['funny', 'hilarious', 'joke', 'laugh', 'silly', 'ridiculous'];

    creativeWords.forEach(word => {
      if (words.includes(word)) creativity += 10;
    });

    actionWords.forEach(word => {
      if (words.includes(word)) feasibility += 8;
    });

    funnyWords.forEach(word => {
      if (words.includes(word)) humor += 15;
    });

    // Ensure scores are within bounds
    creativity = Math.max(10, Math.min(100, creativity));
    feasibility = Math.max(10, Math.min(100, feasibility));
    humor = Math.max(0, Math.min(100, humor));
    originality = Math.max(10, Math.min(100, originality));

    // Calculate speed bonus based on response time
    let speedBonus = 0;
    if (responseTimeSeconds !== undefined) {
      // Optimal response time is around 30-60 seconds
      // Too fast (< 15s) might be low quality, too slow (> 120s) gets no bonus
      if (responseTimeSeconds >= 15 && responseTimeSeconds <= 30) {
        speedBonus = 15; // Fast and thoughtful
      } else if (responseTimeSeconds > 30 && responseTimeSeconds <= 60) {
        speedBonus = 10; // Good timing
      } else if (responseTimeSeconds > 60 && responseTimeSeconds <= 90) {
        speedBonus = 5; // Decent timing
      } else if (responseTimeSeconds > 90 && responseTimeSeconds <= 120) {
        speedBonus = 2; // Slow but acceptable
      }
      // No bonus for < 15s (too rushed) or > 120s (too slow)
    }

    const baseScore = (creativity + feasibility + humor + originality) / 4;
    const totalScore = Math.min(100, baseScore + speedBonus);

    // Determine path recommendation
    let pathRecommendation: 'shorter_path' | 'normal_path' | 'longer_path' = 'normal_path';
    if (totalScore >= 70) {
      pathRecommendation = 'shorter_path';
    } else if (totalScore <= 40) {
      pathRecommendation = 'longer_path';
    }

    return {
      total_score: totalScore,
      metrics: {
        creativity,
        feasibility,
        humor,
        originality,
        speed_bonus: speedBonus,
      },
      feedback: this.generateFeedback(totalScore, creativity, feasibility, humor, originality, speedBonus, responseTimeSeconds),
      path_recommendation: pathRecommendation,
    };
  }

  private generateFeedback(total: number, creativity: number, feasibility: number, humor: number, originality: number, speedBonus?: number, responseTime?: number): string {
    const feedbacks = [];

    if (total >= 80) {
      feedbacks.push("Excellent response!");
    } else if (total >= 60) {
      feedbacks.push("Good thinking!");
    } else if (total >= 40) {
      feedbacks.push("Not bad, but could be better.");
    } else {
      feedbacks.push("Try to think more creatively.");
    }

    if (creativity >= 80) {
      feedbacks.push("Very creative approach!");
    }
    if (feasibility >= 80) {
      feedbacks.push("Practical and realistic.");
    }
    if (humor >= 70) {
      feedbacks.push("Nice touch of humor!");
    }
    if (originality >= 80) {
      feedbacks.push("Unique and original thinking!");
    }

    // Add speed-related feedback
    if (speedBonus && speedBonus > 0 && responseTime) {
      if (speedBonus >= 15) {
        feedbacks.push("Lightning fast response with great quality!");
      } else if (speedBonus >= 10) {
        feedbacks.push("Great timing on your response!");
      } else if (speedBonus >= 5) {
        feedbacks.push("Good response time!");
      } else {
        feedbacks.push("Nice thoughtful response!");
      }
    } else if (responseTime && responseTime > 120) {
      feedbacks.push("Take your time, but try to be a bit quicker next time!");
    } else if (responseTime && responseTime < 15) {
      feedbacks.push("Quick response! Try adding more detail for higher scores.");
    }

    return feedbacks.join(" ");
  }
}

export const scoringService = new ScoringService();