import { HALLOWEEN_SCENARIOS, type ScenarioData } from '../data/halloweenScenarios';

class ScenarioService {
  private scenarios: ScenarioData[] = [];
  private shuffledScenarios: ScenarioData[] = [];
  private scenarioQueue: ScenarioData[] = [];
  private usedScenarios: Set<number> = new Set();
  private isLoaded = false;

  // Fisher-Yates shuffle algorithm
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }

  // Load scenarios from hardcoded data
  private loadScenarios(): void {
    if (this.isLoaded) return;

    console.log('🔄 [SCENARIO] Loading hardcoded scenarios...');

    // Use the hardcoded Halloween scenarios directly
    this.scenarios = HALLOWEEN_SCENARIOS;

    // Shuffle scenarios to randomize order
    this.shuffledScenarios = this.shuffleArray([...this.scenarios]);
    this.scenarioQueue = [...this.shuffledScenarios];

    console.log(`✅ [SCENARIO] Loaded ${this.scenarios.length} hardcoded scenarios`);
    this.isLoaded = true;
  }





  getRandomScenario(): ScenarioData {
    console.log('🎲 [SCENARIO] Getting random scenario...');

    this.loadScenarios();

    // If queue is empty, refill with a fresh shuffle
    if (this.scenarioQueue.length === 0) {
      this.scenarioQueue = this.shuffleArray([...this.scenarios]);
      console.log(`🔄 [SCENARIO] Refilled scenario queue with ${this.scenarioQueue.length} shuffled scenarios`);
    }

    // Pop the next scenario from the queue
    const scenario = this.scenarioQueue.shift();
    if (!scenario) {
      console.error('❌ [SCENARIO] No scenario available in queue, total scenarios:', this.scenarios.length);
      throw new Error('No scenario available in queue');
    }

    console.log(`📄 [SCENARIO] Serving scenario from queue. ${this.scenarioQueue.length} remaining.`);
    console.log(`📝 [SCENARIO] Scenario preview:`, scenario.scenario.substring(0, 100) + '...');
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

  // Reset and reshuffle the scenario queue
  resetScenarioQueue(): void {
    this.scenarioQueue = this.shuffleArray([...this.scenarios]);
    console.log(`🔄 Reset and reshuffled scenario queue with ${this.scenarioQueue.length} scenarios`);
  }

  // Get remaining scenarios in queue
  getRemainingInQueue(): number {
    return this.scenarioQueue.length;
  }
}

export const scenarioService = new ScenarioService();
export type { ScenarioData };