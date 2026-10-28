import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

export interface AdminUser {
  email: string;
  name?: string;
}

const STORAGE_KEY = 'admin_user';

/**
 * Service d'authentification ADMIN, séparé de AuthService (utilisateurs testeurs).
 * Comme AuthService, c'est une version "démo" : accepte tout email/mot de passe
 * valides et persiste uniquement côté client (localStorage). Prêt à être branché
 * sur un vrai backend d'authentification admin plus tard (mêmes noms de méthodes).
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private currentAdminSubject = new BehaviorSubject<AdminUser | null>(null);
  public currentAdmin$ = this.currentAdminSubject.asObservable();

  constructor(private router: Router) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.currentAdminSubject.next(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  login(email: string, password: string): boolean {
    if (!email || !password) return false;
    const admin: AdminUser = { email, name: email.split('@')[0] || 'Admin' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(admin));
    this.currentAdminSubject.next(admin);
    return true;
  }

  signup(data: { email: string; firstName?: string; [key: string]: any }): boolean {
    if (!data || !data.email) return false;
    const admin: AdminUser = { email: data.email, name: data.firstName || 'Admin' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(admin));
    this.currentAdminSubject.next(admin);
    return true;
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentAdminSubject.next(null);
    this.router.navigate(['/admin/login']);
  }

  isAuthenticated(): boolean {
    if (this.currentAdminSubject.value !== null) return true;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.currentAdminSubject.next(JSON.parse(saved));
        return true;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
    }
    return false;
  }
}