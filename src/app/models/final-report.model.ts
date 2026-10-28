export interface FinalTestResult {
  id: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
}

export interface FinalDefect {
  id: string;
  description: string;
  severity: 'Critical' | 'Major' | 'Minor';
  status: 'Open' | 'Fixed' | 'Reopened';
}

export interface FinalReport {
  groupNumber: string;
  projectTitle: string;
  members: string[];
  projectContext: string;
  environment: string;
  tools: string[];
  executionApproach: 'Manual' | 'Automated' | 'Hybrid';
  executionDescription: string;
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
  functionalResults: FinalTestResult[];
  functionalAnalysis: string;
  securityTested: string;
  securityResults: string;
  performanceScenario: string;
  performanceAvgResponse: string;
  performanceErrorRate: string;
  performanceInterpretation: string;
  defects: FinalDefect[];
  metrics: string;
  discussion: string;
  recommendations: string[];
  conclusion: string;
  evidence: string;
}