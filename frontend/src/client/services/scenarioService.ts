interface ScenarioData {
  scenario: string;
  reasoning: string;
}

class ScenarioService {
  private scenarios: ScenarioData[] = [];
  private usedScenarios: Set<number> = new Set();
  private isLoaded = false;

  // Load scenarios from CSV data
  private async loadScenarios(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // Load the full reasoning dataset CSV file
      const response = await fetch('/data/reasoning_dataset.csv');
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status}`);
      }

      const csvData = await response.text();
      this.scenarios = this.parseCsv(csvData);

      console.log(`✅ Loaded ${this.scenarios.length} scenarios from reasoning_dataset.csv`);
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load scenarios from CSV file, using fallback:', error);

      // Fallback to a few hardcoded scenarios if CSV loading fails
      this.scenarios = [
        {
          scenario: "You're cycling in a narrow path and you see a herd of bulls charging at you.",
          reasoning: "WORST move: Cycling furiously toward them like you're starring in your own action movie - congratulations, you're now a human pancake and the bulls are telling their grandkids about 'that idiot cyclist.' BEST move: Calmly dismount and step aside like a matador with common sense."
        },
        {
          scenario: "You are allergic to laughter and attending a stand up show.",
          reasoning: "WORST move: Stay in your seat out of politeness and laugh along, resulting in your face swelling up like a balloon animal until you look like the Michelin Man's distant cousin. BEST move: Leave immediately or pop antihistamines like candy."
        },
        {
          scenario: "Your phone freezes while taking a selfie with a celebrity you accidentally met.",
          reasoning: "WORST move: Shake your phone violently while screaming 'WORK, YOU PIECE OF JUNK' at the celebrity, who slowly backs away thinking you're having a mental episode. BEST move: Laugh it off and ask if they'd mind trying again."
        }
      ];
      this.isLoaded = true;
    }
  }

  private parseCsv(csvData: string): ScenarioData[] {
    const lines = csvData.split('\n');
    const scenarios: ScenarioData[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Enhanced CSV parsing - handles quoted fields with escaped quotes
        const result = this.parseCSVLine(line);
        if (result && result.length >= 2) {
          scenarios.push({
            scenario: result[0],
            reasoning: result[1]
          });
        }
      } catch (error) {
        console.warn(`Failed to parse CSV line ${i + 1}:`, line, error);
      }
    }

    return scenarios;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current);

    return result;
  }



  async getRandomScenario(): Promise<ScenarioData> {
    await this.loadScenarios();

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