import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api';

export interface Bug {
  id: string;
  name: string;
  description: string;
  priority: string;
  status: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class BugStateService {
  private bugsSubject = new BehaviorSubject<Bug[]>([]);
  bugs$ = this.bugsSubject.asObservable();

  constructor(private api: ApiService) {}

  loadBugs(): void {
    this.api.getBugs('OPEN').subscribe({
      next: (bugs) => this.bugsSubject.next(bugs),
      error: (err) => console.error('❌ Erreur chargement bugs :', err)
    });
  }

  refresh(): void {
    this.loadBugs();
  }
}