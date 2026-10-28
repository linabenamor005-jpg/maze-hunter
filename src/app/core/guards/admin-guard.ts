import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private adminAuth: AdminAuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.adminAuth.isAuthenticated()) {
      return true;
    }
    this.router.navigate(['/admin/login']);
    return false;
  }
}