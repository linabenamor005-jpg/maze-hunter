import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Bug {
  id: string;
  name: string;
  priority: 'CRITIQUE' | 'HIGH' | 'MEDIUM' | 'LOW';
  fixed: boolean;
}

@Injectable({ providedIn: 'root' })
export class BugService {
  private bugs: Bug[] = [
    { id: 'BUG-031', name: 'Injection SQL bypass auth', priority: 'CRITIQUE', fixed: false },
    { id: 'BUG-029', name: 'XSS champ commentaire', priority: 'CRITIQUE', fixed: false },
    { id: 'BUG-030', name: 'Timeout API /search', priority: 'HIGH', fixed: false },
    { id: 'BUG-022', name: 'Erreur affichage tableau', priority: 'MEDIUM', fixed: false },
    { id: 'BUG-018', name: 'Crash menu mobile', priority: 'HIGH', fixed: false },
    { id: 'BUG-014', name: 'Cache invalide dashboard', priority: 'MEDIUM', fixed: false },
    { id: 'BUG-027', name: 'Mauvais format de date', priority: 'LOW', fixed: false },
    { id: 'BUG-009', name: 'Doublon de notification', priority: 'LOW', fixed: false },
    { id: 'BUG-033', name: 'Fuite mémoire au scroll', priority: 'MEDIUM', fixed: false },
    { id: 'BUG-005', name: 'Bouton inactif sur Safari', priority: 'HIGH', fixed: false }
  ];

  private bugsSubject = new BehaviorSubject<Bug[]>(this.bugs);
  public bugs$ = this.bugsSubject.asObservable();

  getBugs(): Bug[] {
    return this.bugs;
  }

  fixBug(id: string): void {
    const bug = this.bugs.find(b => b.id === id);
    if (bug) {
      bug.fixed = true;
      this.bugsSubject.next([...this.bugs]);
    }
  }

  getUnfixedBugs(): Bug[] {
    return this.bugs.filter(b => !b.fixed);
  }

  getNextBug(): Bug | null {
    const unfixed = this.getUnfixedBugs();
    return unfixed.length > 0 ? unfixed[0] : null;
  }
}