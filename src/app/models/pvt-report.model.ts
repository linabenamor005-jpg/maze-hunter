export interface PvvTestScenario {
  id: string;
  name: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  priority: 'Critical' | 'Major' | 'Minor';
}

export interface PvvReport {
  groupNumber: string;
  projectTitle: string;
  members: string[];
  projectDescription: string;
  objectives: string;
  includedFeatures: string;
  excludedFeatures: string;
  strategyDescription: string;
  tools: string[];
  functionalTesting: {
    objective: string;
    description: string;
  };
  securityTesting: {
    objective: string;
    description: string;
  };
  performanceTesting: {
    objective: string;
    description: string;
  };
  scenarios: PvvTestScenario[];
  testData: string;
  validationCriteria: string;
}