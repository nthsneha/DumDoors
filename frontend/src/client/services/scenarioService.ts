interface ScenarioData {
  scenario: string;
  reasoning: string;
}

class ScenarioService {
  private scenarios: ScenarioData[] = [
    {
      scenario: "You're cycling in a narrow path and you see a herd of bulls charging at you.",
      reasoning: "WORST move: Cycling furiously toward them like you're starring in your own action movie - congratulations, you're now a human pancake and the bulls are telling their grandkids about 'that idiot cyclist.' BEST move: Calmly dismount and step aside like a matador with common sense. Even in the most exaggerated outcome, you're alive to tell the embarrassing story at dinner parties instead of being the cautionary tale parents tell their kids."
    },
    {
      scenario: "You wake up one day and see that your entire body is flakey.",
      reasoning: "WORST decision: Panic-scratch yourself into a snowstorm of skin confetti while screaming about spontaneous mummification. You'll look like a human parmesan grater went rogue. BEST decision: Moisturize like your life depends on it and call a dermatologist. Even exaggerated, you might be shiny as a disco ball for a day, but at least you're not bleeding from scratching yourself raw and getting a staph infection that makes you actually fall apart."
    },
    {
      scenario: "You are allergic to laughter and attending a stand up show.",
      reasoning: "WORST move: Stay in your seat out of politeness and laugh along, resulting in your face swelling up like a balloon animal until you look like the Michelin Man's distant cousin. BEST move: Leave immediately or pop antihistamines like candy. Exaggerated outcome? You miss some jokes but keep your ability to breathe. The alternative is being carried out on a stretcher while the comedian makes you part of their set."
    },
    {
      scenario: "You want to keep your relationship private and the next door snitch finds out about it.",
      reasoning: "WORST decision: Threaten them with creative violence or offer bribes that escalate into a full blackmail situation worthy of a bad soap opera. BEST decision: Have a mature conversation about boundaries. Even exaggerated, the worst that happens is they gossip a bit and people say 'oh, neat.' The alternative is a restraining order and explaining to police why you offered your neighbor $5000 in cash and a kidney."
    },
    {
      scenario: "You send a private photo in your family group chat and click on 'delete for me' instead of 'delete for everyone' by mistake.",
      reasoning: "WORST move: Fake your own death and move to another country, leaving your family wondering if you were abducted by aliens who needed that specific photo. BEST move: Immediately send a casual 'wrong chat, my bad!' and laugh it off. Exaggerated best case: mild embarrassment for a week. Exaggerated worst case from fleeing: your face on milk cartons and a family convinced you're in witness protection."
    },
    {
      scenario: "Your close mutual friends are dating in secret, they haven't told you and you just catch them in the act one day.",
      reasoning: "WORST decision: Gasp dramatically, demand explanations, and interrogate them like a jealous ex-partner until they break up just to escape the drama you've created. BEST decision: Smile, say 'about time!' and walk away. Exaggerated best outcome: you're the cool friend who gets invited to the wedding. Exaggerated worst outcome: you're the reason there IS no wedding and both friends hate you forever."
    },
    {
      scenario: "Your roommate only answers in binary and you need to convince him/her for something.",
      reasoning: "WORST move: Scream in regular English louder and louder like volume fixes language barriers, eventually having a breakdown and crying in the corner. BEST move: Learn basic binary or ask yes/no questions strategically. Exaggerated best case: you have a quirky conversation and get what you need. Worst case: you're known as 'that roommate who couldn't figure out 1s and 0s' and still don't have toilet paper."
    },
    {
      scenario: "You feel an intense urge to sneeze but you've been holding in a fart in the middle of an important official meeting. You can't go to the washroom.",
      reasoning: "WORST move: Let both rip simultaneously, creating a biological symphony that gets you internet famous as 'Double Trouble' in the corporate fail compilation. BEST move: Fake a coughing fit that covers the sneeze and strategically release the other threat. Exaggerated best case: people think you're getting sick and offer you sympathy. Worst case: you become a meme and your grandchildren find it in 2045."
    },
    {
      scenario: "Someone locked you in the washroom and you don't have your phone with you.",
      reasoning: "WORST decision: Immediately start panic-crying and trying to drink from the toilet because you've clearly watched too many survival shows. BEST decision: Knock systematically, check the lock mechanism, stay calm. Exaggerated best outcome: someone hears you in 10 minutes. Exaggerated worst outcome from panicking: you flood the bathroom trying to 'send a water signal' and cause $10,000 in damage."
    },
    {
      scenario: "You accidentally reply-all to an email complaining about your boss.",
      reasoning: "WORST move: Claim you were hacked by Russian spies who specifically wanted to ruin your career, then actually try to hire hackers to prove it. BEST move: Immediately reply-all with a genuine apology and own your mistake. Exaggerated best case: you're known for integrity and keep your job. Worst case: you're featured in a cybersecurity training video as 'don't be this person' and the FBI is confused about your hacker story."
    },
    {
      scenario: "Your headphones are tangled with your dog's leash and you're late for an important meeting.",
      reasoning: "WORST decision: Try to untangle them perfectly while the dog drags you through the neighborhood like a tangled kite, arriving 45 minutes late covered in mud. BEST decision: Cut the headphone cord - it's $20 vs. your career. Exaggerated best case: you're on time and buy new headphones. Worst case: you become the 'dog-walking disaster' in your office legend, forever late and disheveled."
    },
    {
      scenario: "You try to cook spaghetti but the water boils over and floods the kitchen just as your date arrives.",
      reasoning: "WORST move: Try to hide it by throwing towels everywhere and pretending everything's fine while standing in a literal kitchen lake. BEST move: Laugh, turn it off, order takeout, and make it a funny story. Exaggerated best outcome: they find your chaos endearing and it becomes your 'how we fell in love' story. Worst outcome: they slip in the water, break their tailbone, and sue you for medical bills."
    },
    {
      scenario: "Your neighbor's parrot starts repeating your secrets loudly in the elevator.",
      reasoning: "WORST decision: Try to strangle the parrot in front of witnesses, getting arrested for animal abuse and proving you're the villain the parrot claimed you were. BEST decision: Laugh awkwardly and say 'parrots say the craziest random things!' Exaggerated best case: people think it's nonsense. Worst case: you're doing community service for attempted bird murder and everyone believes the secrets anyway."
    },
    {
      scenario: "Your phone freezes while taking a selfie with a celebrity you accidentally met.",
      reasoning: "WORST move: Aggressively shake your phone, throw it against a wall to 'restart it,' and scream about technology while the celebrity backs away slowly. BEST move: Apologize, have a genuine moment of conversation instead. Exaggerated best outcome: they remember you as 'that nice person' not 'photo person #4839.' Worst outcome: security tackles you for aggressive behavior and your broken phone video goes viral."
    },
    {
      scenario: "You apply soap all over your body while taking a bath and water runs out.",
      reasoning: "WORST decision: Air-dry and just... go about your day as a crusty soap statue, eventually developing a painful rash that requires hospitalization. BEST decision: Use wet towels, bottled water, or neighbor's help. Exaggerated best case: you're clean and slightly inconvenienced. Worst case: you're admitted to the ER explaining why you're chemically burned and smell like Irish Spring's revenge."
    }
  ];

  private usedScenarios: Set<number> = new Set();



  getRandomScenario(): ScenarioData {
    // If all scenarios have been used, reset
    if (this.usedScenarios.size >= this.scenarios.length) {
      this.usedScenarios.clear();
    }

    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * this.scenarios.length);
    } while (this.usedScenarios.has(randomIndex));

    this.usedScenarios.add(randomIndex);
    const scenario = this.scenarios[randomIndex];
    if (!scenario) {
      throw new Error('No scenario found at index');
    }
    return scenario;
  }

  getScenarioByIndex(index: number): ScenarioData | null {
    if (index >= 0 && index < this.scenarios.length) {
      return this.scenarios[index] || null;
    }
    return null;
  }

  getAllScenarios(): ScenarioData[] {
    return [...this.scenarios];
  }

  getTotalScenarios(): number {
    return this.scenarios.length;
  }

  resetUsedScenarios(): void {
    this.usedScenarios.clear();
  }
}

export const scenarioService = new ScenarioService();
export type { ScenarioData };