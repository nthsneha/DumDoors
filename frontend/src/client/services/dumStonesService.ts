interface GameResponse {
    scenario: string;
    response: string;
    score: number;
}

interface DumStoneReport {
    title: string;
    personality: string;
    roast: string;
    strengths: string[];
    weaknesses: string[];
    funnyQuote: string;
    overallGrade: string;
    emoji: string;
}

class DumStonesService {
    async generateReport(responses: GameResponse[]): Promise<DumStoneReport> {
        if (responses.length === 0) {
            return {
                title: "The Ghost Player",
                personality: "Mysterious Phantom",
                roast: "You managed to play without actually playing. That's... impressive?",
                strengths: ["Invisibility", "Mystery"],
                weaknesses: ["Existence", "Participation"],
                funnyQuote: "I came, I saw, I... left?",
                overallGrade: "?/10",
                emoji: "👻"
            };
        }

        try {
            console.log('Making request to server-side Dum-Stones analysis endpoint');
            const response = await fetch('/api/dumstones', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    responses: responses
                }),
            });

            if (!response.ok) {
                let errorMessage = `Server error: ${response.status}`;
                try {
                    const responseText = await response.text();
                    try {
                        const errorData = JSON.parse(responseText);
                        errorMessage = errorData.message || errorMessage;
                    } catch (jsonError) {
                        // If it's not JSON, use the text as the error message
                        errorMessage = responseText || errorMessage;
                    }
                } catch (textError) {
                    console.warn('Failed to read error response:', textError);
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const report = await response.json();
            console.log('Server Dum-Stones response:', report);

            return {
                title: report.title,
                personality: report.personality,
                roast: report.roast,
                strengths: report.strengths,
                weaknesses: report.weaknesses,
                funnyQuote: report.funnyQuote,
                overallGrade: report.overallGrade,
                emoji: report.emoji
            };
        } catch (error) {
            console.error('Server-side Dum-Stones analysis error:', error);

            // Check if it's a 404 (endpoint not implemented yet)
            if (error instanceof Error && error.message.includes('404')) {
                console.log('Dum-Stones API endpoint not available, using enhanced fallback');
            }

            return this.getFallbackReport(responses);
        }
    }



    private getFallbackReport(responses: GameResponse[]): DumStoneReport {
        const averageScore = responses.reduce((sum, r) => sum + r.score, 0) / responses.length;

        // Analyze response patterns for better fallback
        const responseTexts = responses.map(r => r.response.toLowerCase());
        const isAggressive = responseTexts.some(r =>
            r.includes('fight') || r.includes('attack') || r.includes('punch') || r.includes('hit')
        );
        const isPassive = responseTexts.some(r =>
            r.includes('run') || r.includes('hide') || r.includes('avoid') || r.includes('escape')
        );
        const isCreative = responseTexts.some(r =>
            r.includes('creative') || r.includes('think') || r.includes('plan') || r.includes('idea')
        );

        // Generate personality-based report
        if (averageScore >= 80) {
            return {
                title: "The Overachiever Supreme",
                personality: "Annoyingly Perfect Human",
                roast: "You're that person who not only reads the instruction manual but highlights it and takes notes. Your responses are so methodical, they make spreadsheets jealous. We get it, you're responsible.",
                strengths: ["Strategic planning", "Rule following", "Making others feel inadequate", "Probably has color-coded calendars"],
                weaknesses: ["Fun", "Spontaneity", "Accepting that sometimes chaos is okay", "Relaxing literally ever"],
                funnyQuote: "I don't just think outside the box, I optimize the box's efficiency ratings first.",
                overallGrade: "A+ (Teacher's Pet Extraordinaire)",
                emoji: "🤓"
            };
        } else if (averageScore >= 60) {
            if (isCreative) {
                return {
                    title: "The Creative Chaos",
                    personality: "Beautifully Unpredictable",
                    roast: "Your brain works in mysterious ways - like a GPS that takes scenic routes through dimensions. Your solutions are either genius or completely insane. There's no middle ground.",
                    strengths: ["Outside-the-box thinking", "Entertainment value", "Keeping things interesting", "Making simple things complicated"],
                    weaknesses: ["Conventional logic", "Simple solutions", "Following instructions", "Being predictable"],
                    funnyQuote: "Why take the easy path when you can build a catapult?",
                    overallGrade: "B+ (For Creativity)",
                    emoji: "🎨"
                };
            } else {
                return {
                    title: "The Solid Citizen",
                    personality: "Reliably Average",
                    roast: "You're the human equivalent of vanilla ice cream - not bad, but nobody's getting excited. Your responses are sensible, practical, and about as thrilling as watching paint dry.",
                    strengths: ["Common sense", "Reliability", "Not making things worse", "Being the voice of reason"],
                    weaknesses: ["Excitement", "Risk-taking", "Standing out", "Being memorable"],
                    funnyQuote: "I don't always play it safe, but when I do, I really do.",
                    overallGrade: "B (Solid B)",
                    emoji: "😐"
                };
            }
        } else if (averageScore >= 40) {
            if (isAggressive) {
                return {
                    title: "The Chaos Goblin",
                    personality: "Violence is Always an Option",
                    roast: "Your solution to every problem is apparently 'punch it.' Locked door? Punch it. Difficult conversation? Punch it. Math homework? Believe it or not, also punch it.",
                    strengths: ["Directness", "Confidence", "Intimidation factor", "Solving problems with enthusiasm"],
                    weaknesses: ["Subtlety", "Diplomacy", "Not getting arrested", "Indoor voice"],
                    funnyQuote: "I don't have anger issues, I have anger solutions!",
                    overallGrade: "C- (Concerning)",
                    emoji: "😤"
                };
            } else if (isPassive) {
                return {
                    title: "The Professional Runner",
                    personality: "Strategic Retreat Specialist",
                    roast: "Your fight-or-flight response is permanently stuck on 'flight.' You've turned avoiding problems into an art form. If running away was an Olympic sport, you'd have gold medals.",
                    strengths: ["Self-preservation", "Cardio fitness", "Knowing your limits", "Exit strategy planning"],
                    weaknesses: ["Confrontation", "Standing your ground", "Helping others", "Staying put"],
                    funnyQuote: "I'm not running away, I'm advancing in the opposite direction!",
                    overallGrade: "C (Could do better)",
                    emoji: "🏃‍♂️"
                };
            } else {
                return {
                    title: "The Confused Wanderer",
                    personality: "Perpetually Lost",
                    roast: "You approach problems like a tourist without a map - lots of wandering, occasional panic, and somehow ending up further from your destination. Your responses suggest you might be playing a different game entirely.",
                    strengths: ["Optimism", "Persistence", "Entertainment value", "Making others feel smarter"],
                    weaknesses: ["Direction", "Focus", "Understanding the assignment", "GPS skills"],
                    funnyQuote: "I may not know where I'm going, but I'm making great time!",
                    overallGrade: "C- (Participation trophy)",
                    emoji: "🤷‍♂️"
                };
            }
        } else {
            return {
                title: "The Magnificent Disaster",
                personality: "Chaos Incarnate",
                roast: "You've turned poor decision-making into an art form. Your responses are so spectacularly wrong, they're almost impressive. It's like watching a train wreck in slow motion - horrible, but you can't look away.",
                strengths: ["Unpredictability", "Comic relief", "Making everyone else feel smarter", "Commitment to chaos"],
                weaknesses: ["Logic", "Common sense", "Basic survival instincts", "Learning from literally anything"],
                funnyQuote: "I don't always make terrible decisions, but when I do, I make them spectacularly.",
                overallGrade: "D (For Dedication to Disaster)",
                emoji: "💥"
            };
        }
    }


}

export const dumStonesService = new DumStonesService();