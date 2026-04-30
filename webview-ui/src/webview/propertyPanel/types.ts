export interface StepData {
  value: unknown;
  [key: string]: unknown;
}

export interface PropertyData {
  discarded: boolean;
  steps: StepData[];
}

export type CounterexampleData = Record<string, PropertyData>;
