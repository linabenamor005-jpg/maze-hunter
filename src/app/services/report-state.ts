import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PvvReport } from '../models/pvt-report.model';
import { FinalReport } from '../models/final-report.model';

@Injectable({ providedIn: 'root' })
export class ReportStateService {
  private pvtSubject = new BehaviorSubject<PvvReport>(this.defaultPvt());
  private finalSubject = new BehaviorSubject<FinalReport>(this.defaultFinal());

  pvt$ = this.pvtSubject.asObservable();
  final$ = this.finalSubject.asObservable();

  updatePvt(report: Partial<PvvReport>) {
    const current = this.pvtSubject.value;
    this.pvtSubject.next({ ...current, ...report });
  }

  updateFinal(report: Partial<FinalReport>) {
    const current = this.finalSubject.value;
    this.finalSubject.next({ ...current, ...report });
  }

  private defaultPvt(): PvvReport {
    return {
      groupNumber: '',
      projectTitle: '',
      members: [],
      projectDescription: '',
      objectives: '',
      includedFeatures: '',
      excludedFeatures: '',
      strategyDescription: '',
      tools: [],
      functionalTesting: { objective: '', description: '' },
      securityTesting: { objective: '', description: '' },
      performanceTesting: { objective: '', description: '' },
      scenarios: [],
      testData: '',
      validationCriteria: ''
    };
  }

  private defaultFinal(): FinalReport {
    return {
      groupNumber: '',
      projectTitle: '',
      members: [],
      projectContext: '',
      environment: '',
      tools: [],
      executionApproach: 'Hybrid',
      executionDescription: '',
      totalTests: 0,
      passed: 0,
      failed: 0,
      successRate: 0,
      functionalResults: [],
      functionalAnalysis: '',
      securityTested: '',
      securityResults: '',
      performanceScenario: '',
      performanceAvgResponse: '',
      performanceErrorRate: '',
      performanceInterpretation: '',
      defects: [],
      metrics: '',
      discussion: '',
      recommendations: [],
      conclusion: '',
      evidence: ''
    };
  }
}