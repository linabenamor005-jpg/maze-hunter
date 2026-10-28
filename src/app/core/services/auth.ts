import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  email: string;
  name?: string;
}

const STORAGE_KEY = 'user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private router: Router) {
    // Restaurer l'utilisateur depuis localStorage au démarrage / rechargement
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.currentUserSubject.next(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  /**
   * Connexion "démo" : accepte n'importe quel email / mot de passe.
   * Synchrone pour éviter les soucis d'Observable jamais souscrit.
   */
  login(email: string, password: string): boolean {
    if (!email || !password) return false;
    const user: User = { email, name: email.split('@')[0] || 'Hunter' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    return true;
  }

  /**
   * Inscription "démo" : accepte n'importe quelles données valides du formulaire.
   */
  signup(userData: { email: string; firstName?: string; [key: string]: any }): boolean {
    if (!userData || !userData.email) return false;
    const user: User = { email: userData.email, name: userData.firstName || 'Hunter' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    return true;
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    if (this.currentUserSubject.value !== null) return true;

    // Le BehaviorSubject peut être vide juste après un rechargement de page
    // (avant que le constructeur n'ait eu la main) : on retombe sur localStorage.
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.currentUserSubject.next(JSON.parse(saved));
        return true;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
    }
    return false;
  }
}
