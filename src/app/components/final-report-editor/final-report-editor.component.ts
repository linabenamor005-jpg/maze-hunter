import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormArray, FormGroup } from '@angular/forms';
import { ReportStateService } from '../../services/report-state';
import { FinalReport } from '../../models/final-report.model';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-final-report-editor',
  standalone: false,
  templateUrl: './final-report-editor.component.html',
  styleUrls: ['./final-report-editor.component.scss']
})
export class FinalReportEditorComponent implements OnInit {
  finalForm!: FormGroup;
  importing = false;
  importMessage = '';

  constructor(
    private fb: FormBuilder,
    private state: ReportStateService,
    private api: ApiService
  ) {}

  ngOnInit() {
    this.finalForm = this.fb.group({
      groupNumber: [''],
      projectTitle: [''],
      members: this.fb.array([]),
      projectContext: [''],
      environment: [''],
      tools: this.fb.array([]),
      executionApproach: ['Hybrid'],
      executionDescription: [''],
      totalTests: [0],
      passed: [0],
      failed: [0],
      successRate: [0],
      functionalResults: this.fb.array([]),
      functionalAnalysis: [''],
      securityTested: [''],
      securityResults: [''],
      performanceScenario: [''],
      performanceAvgResponse: [''],
      performanceErrorRate: [''],
      performanceInterpretation: [''],
      defects: this.fb.array([]),
      metrics: [''],
      discussion: [''],
      recommendations: this.fb.array([]),
      conclusion: [''],
      evidence: ['']
    });

    this.state.final$.subscribe((data: FinalReport) => {
      if (data) {
        this.finalForm.patchValue({
          groupNumber: data.groupNumber,
          projectTitle: data.projectTitle,
          projectContext: data.projectContext,
          environment: data.environment,
          executionApproach: data.executionApproach,
          executionDescription: data.executionDescription,
          totalTests: data.totalTests,
          passed: data.passed,
          failed: data.failed,
          successRate: data.successRate,
          functionalAnalysis: data.functionalAnalysis,
          securityTested: data.securityTested,
          securityResults: data.securityResults,
          performanceScenario: data.performanceScenario,
          performanceAvgResponse: data.performanceAvgResponse,
          performanceErrorRate: data.performanceErrorRate,
          performanceInterpretation: data.performanceInterpretation,
          metrics: data.metrics,
          discussion: data.discussion,
          conclusion: data.conclusion,
          evidence: data.evidence
        });
        this.setMembers(data.members || []);
        this.setTools(data.tools || []);
        this.setFunctionalResults(data.functionalResults || []);
        this.setDefects(data.defects || []);
        this.setRecommendations(data.recommendations || []);
      }
    });

    this.finalForm.valueChanges.subscribe(value => {
      const report: Partial<FinalReport> = {
        ...value,
        members: this.members.value,
        tools: this.tools.value,
        functionalResults: this.functionalResults.value,
        defects: this.defects.value,
        recommendations: this.recommendations.value
      };
      this.state.updateFinal(report);
    });
  }

  get members(): FormArray { return this.finalForm.get('members') as FormArray; }
  get tools(): FormArray { return this.finalForm.get('tools') as FormArray; }
  get functionalResults(): FormArray { return this.finalForm.get('functionalResults') as FormArray; }
  get defects(): FormArray { return this.finalForm.get('defects') as FormArray; }
  get recommendations(): FormArray { return this.finalForm.get('recommendations') as FormArray; }

  addMember() { this.members.push(this.fb.control('')); }
  private setMembers(members: string[]) {
    this.members.clear();
    members.forEach(m => this.members.push(this.fb.control(m)));
  }

  addTool() { this.tools.push(this.fb.control('')); }
  private setTools(tools: string[]) {
    this.tools.clear();
    tools.forEach(t => this.tools.push(this.fb.control(t)));
  }

  addFunctionalResult() {
    this.functionalResults.push(this.fb.group({
      id: [''],
      expected: [''],
      actual: [''],
      status: ['PASS']
    }));
  }
  removeFunctionalResult(index: number) { this.functionalResults.removeAt(index); }
  private setFunctionalResults(results: any[]) {
    this.functionalResults.clear();
    results.forEach(r => {
      this.functionalResults.push(this.fb.group({
        id: [r.id || ''],
        expected: [r.expected || ''],
        actual: [r.actual || ''],
        status: [r.status || 'PASS']
      }));
    });
    if (this.functionalResults.length === 0) this.addFunctionalResult();
  }

  addDefect() {
    this.defects.push(this.fb.group({
      id: [''],
      description: [''],
      severity: ['Major'],
      status: ['Open']
    }));
  }
  removeDefect(index: number) { this.defects.removeAt(index); }
  private setDefects(defects: any[]) {
    this.defects.clear();
    defects.forEach(d => {
      this.defects.push(this.fb.group({
        id: [d.id || ''],
        description: [d.description || ''],
        severity: [d.severity || 'Major'],
        status: [d.status || 'Open']
      }));
    });
    if (this.defects.length === 0) this.addDefect();
  }

  addRecommendation() { this.recommendations.push(this.fb.control('')); }
  removeRecommendation(index: number) { this.recommendations.removeAt(index); }
  private setRecommendations(recommendations: string[]) {
    this.recommendations.clear();
    recommendations.forEach(r => this.recommendations.push(this.fb.control(r)));
    if (this.recommendations.length === 0) this.addRecommendation();
  }

  exportPDF() { window.print(); }

  saveTemplate() {
    const json = JSON.stringify(this.finalForm.value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final-report-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  prefillProjectDefaults() {
    if (!this.finalForm.get('environment')?.value) {
      this.finalForm.patchValue({
        environment: 'Backend FastAPI + Oracle DB (Docker) — Frontend Angular servi via ng serve — Scan exécuté en local'
      });
    }
    if (this.tools.length === 0) {
      this.setTools([
        'Playwright — scan automatisé des pages web',
        'BeautifulSoup / Requests — analyse HTML et détection statique',
        'Postman / HTTPX — tests d\'API (endpoints FastAPI)',
        'OWASP Top 10 (checklist manuelle) — tests de sécurité'
      ]);
    }
  }

  importRealData(): void {
    this.importing = true;
    this.importMessage = '';
    this.api.getBugs().subscribe({
      next: (bugs: any[]) => {
        const total = bugs.length;
        const fixed = bugs.filter(b => b.status === 'FIXED').length;
        const open = bugs.filter(b => b.status === 'OPEN').length;
        const successRate = total > 0 ? Math.round((fixed / total) * 1000) / 10 : 0;

        this.finalForm.patchValue({ totalTests: total, passed: fixed, failed: open, successRate });

        const defectRows = bugs.map(b => ({
          id: b.id,
          description: b.name,
          severity: this.mapPriorityToSeverity(b.priority),
          status: b.status === 'FIXED' ? 'Fixed' : 'Open'
        }));
        this.setDefects(defectRows);

        this.importing = false;
        this.importMessage = `✅ ${total} bug(s) importé(s) depuis le Bug Tracker (${fixed} corrigé(s), ${open} ouvert(s)).`;
      },
      error: () => {
        this.importing = false;
        this.importMessage = '❌ Impossible de récupérer les données depuis l\'API (backend indisponible ?).';
      }
    });
  }

  private mapPriorityToSeverity(priority: string): 'Critical' | 'Major' | 'Minor' {
    const p = (priority || '').toUpperCase();
    if (p === 'CRITIQUE' || p === 'CRITICAL') return 'Critical';
    if (p === 'LOW') return 'Minor';
    return 'Major';
  }
}