import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormArray, FormGroup } from '@angular/forms';
import { ReportStateService } from '../../services/report-state';
import { PvvReport } from '../../models/pvt-report.model';

@Component({
  selector: 'app-pvt-editor',
  standalone: false,
  templateUrl: './pvt-editor.component.html',
  styleUrls: ['./pvt-editor.component.scss']
})
export class PvtEditorComponent implements OnInit {
  pvtForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private state: ReportStateService
  ) {}

  ngOnInit() {
    this.pvtForm = this.fb.group({
      groupNumber: [''],
      projectTitle: [''],
      members: this.fb.array([]),
      projectDescription: [''],
      objectives: [''],
      includedFeatures: [''],
      excludedFeatures: [''],
      strategyDescription: [''],
      tools: this.fb.array([]),
      functionalTesting: this.fb.group({
        objective: [''],
        description: ['']
      }),
      securityTesting: this.fb.group({
        objective: [''],
        description: ['']
      }),
      performanceTesting: this.fb.group({
        objective: [''],
        description: ['']
      }),
      scenarios: this.fb.array([]),
      testData: [''],
      validationCriteria: ['']
    });

    this.state.pvt$.subscribe((data: PvvReport) => {
      if (data) {
        this.pvtForm.patchValue({
          groupNumber: data.groupNumber,
          projectTitle: data.projectTitle,
          projectDescription: data.projectDescription,
          objectives: data.objectives,
          includedFeatures: data.includedFeatures,
          excludedFeatures: data.excludedFeatures,
          strategyDescription: data.strategyDescription,
          testData: data.testData,
          validationCriteria: data.validationCriteria,
          functionalTesting: data.functionalTesting,
          securityTesting: data.securityTesting,
          performanceTesting: data.performanceTesting
        });
        this.setMembers(data.members || []);
        this.setTools(data.tools || []);
        this.setScenarios(data.scenarios || []);
      }
    });

    this.pvtForm.valueChanges.subscribe(value => {
      const report: Partial<PvvReport> = {
        ...value,
        members: this.members.value,
        tools: this.tools.value,
        scenarios: this.scenarios.value
      };
      this.state.updatePvt(report);
    });
  }

  get members(): FormArray { return this.pvtForm.get('members') as FormArray; }
  get tools(): FormArray { return this.pvtForm.get('tools') as FormArray; }
  get scenarios(): FormArray { return this.pvtForm.get('scenarios') as FormArray; }

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

  addScenario() {
    const sc = this.fb.group({
      id: [''],
      name: [''],
      preconditions: [''],
      steps: this.fb.array([this.fb.control('')]),
      expectedResult: [''],
      priority: ['Major']
    });
    this.scenarios.push(sc);
  }

  getSteps(index: number): FormArray {
    return (this.scenarios.at(index) as FormGroup).get('steps') as FormArray;
  }

  addStep(scenarioIndex: number) {
    const steps = this.getSteps(scenarioIndex);
    steps.push(this.fb.control(''));
  }

  removeScenario(index: number) { this.scenarios.removeAt(index); }

  private setScenarios(scenarios: any[]) {
    this.scenarios.clear();
    scenarios.forEach(sc => {
      const group = this.fb.group({
        id: [sc.id || ''],
        name: [sc.name || ''],
        preconditions: [sc.preconditions || ''],
        steps: this.fb.array((sc.steps || ['']).map((s: string) => this.fb.control(s))),
        expectedResult: [sc.expectedResult || ''],
        priority: [sc.priority || 'Major']
      });
      this.scenarios.push(group);
    });
    if (this.scenarios.length === 0) this.addScenario();
  }

  exportPDF() { window.print(); }

  saveTemplate() {
    const json = JSON.stringify(this.pvtForm.value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pvt-template-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  prefillProjectDefaults() {
    if (!this.pvtForm.get('projectTitle')?.value) {
      this.pvtForm.patchValue({ projectTitle: 'MAZE HUNTER — Plateforme BLACKBOX' });
    }
    if (this.tools.length === 0) {
      this.setTools([
        'Playwright — scan automatisé des pages web',
        'BeautifulSoup / Requests — analyse HTML et détection statique',
        'Postman / HTTPX — tests d\'API (endpoints FastAPI)',
        'OWASP Top 10 (checklist manuelle) — tests de sécurité'
      ]);
    }
    if (!this.pvtForm.get('strategyDescription')?.value) {
      this.pvtForm.patchValue({
        strategyDescription: 'Le scanner automatisé (Playwright) parcourt les pages cibles et détecte les anomalies (bugs). Chaque bug détecté est ensuite rejoué manuellement dans le Bug Tracker pour confirmer sa reproductibilité avant correction, puis revalidé après correction (test de non-régression via le module de test intégré).'
      });
    }
  }
}