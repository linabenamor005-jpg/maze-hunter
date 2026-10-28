import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    // Vérification robuste : utilise isAuthenticated() qui vérifie aussi localStorage
    if (this.auth.isAuthenticated()) {
      return true;
    }

    // Rediriger vers login si non authentifié
    this.router.navigate(['/login']);
    return false;
  }
}