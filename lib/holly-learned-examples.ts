/**
 * Holly Learned Examples
 *
 * AUTO-GENERATED from real conversation outcomes
 * Last updated: Initial setup (no data yet)
 *
 * These examples will be populated after the first weekly analysis
 * Run: npx tsx scripts/analyze-holly-performance.ts
 */

export interface LearnedExample {
  scenario: string;
  sampleSize: number;
  successRate: number;
  whatWorked: {
    message: string;
    bookingRate: number;
    engagementRate: number;
    whyItWorked: string[];
  };
  whatDidntWork: {
    message: string;
    bookingRate: number;
    engagementRate: number;
    whyItFailed: string[];
  };
}

// Will be populated after first week of data collection
export const LEARNED_EXAMPLES: LearnedExample[] = [];

export function getLearnedExamplesForScenario(scenario: string): LearnedExample | null {
  return LEARNED_EXAMPLES.find((ex) => ex.scenario.toLowerCase().includes(scenario.toLowerCase())) || null;
}
