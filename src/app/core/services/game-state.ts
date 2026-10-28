import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private levelSubject = new BehaviorSubject<number>(1);
  private moneySubject = new BehaviorSubject<number>(0);
  private bugsCollectedSubject = new BehaviorSubject<number>(0);

  level$ = this.levelSubject.asObservable();
  money$ = this.moneySubject.asObservable();
  bugsCollected$ = this.bugsCollectedSubject.asObservable();

  setLevel(level: number): void {
    this.levelSubject.next(level);
  }

  addMoney(amount: number): void {
    this.moneySubject.next(this.moneySubject.value + amount);
  }

  addBugCollected(): void {
    this.bugsCollectedSubject.next(this.bugsCollectedSubject.value + 1);
  }

  reset(): void {
    this.levelSubject.next(1);
    this.moneySubject.next(0);
    this.bugsCollectedSubject.next(0);
  }
}