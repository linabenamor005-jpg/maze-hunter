import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../../core/services/admin-auth';

@Component({
  selector: 'app-admin-login',
  standalone: false,
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.scss']
})
export class AdminLoginComponent {
  loginForm: FormGroup;
  errorMessage = '';

  constructor(private fb: FormBuilder, private adminAuth: AdminAuthService, public router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    this.errorMessage = '';
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      const success = this.adminAuth.login(email, password);
      if (success) {
        this.router.navigate(['/admin/dashboard']);
      } else {
        this.errorMessage = 'Identifiants invalides.';
      }
    }
  }
}