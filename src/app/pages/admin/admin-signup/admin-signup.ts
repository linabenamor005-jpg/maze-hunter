import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../../core/services/admin-auth';

@Component({
  selector: 'app-admin-signup',
  standalone: false,
  templateUrl: './admin-signup.html',
  styleUrls: ['./admin-signup.scss']
})
export class AdminSignupComponent {
  signupForm: FormGroup;
  errorMessage = '';

  constructor(private fb: FormBuilder, private adminAuth: AdminAuthService, public router: Router) {
    this.signupForm = this.fb.group({
      firstName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  onSubmit(): void {
    this.errorMessage = '';
    if (this.signupForm.invalid) return;

    const { firstName, email, password, confirmPassword } = this.signupForm.value;
    if (password !== confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    const success = this.adminAuth.signup({ firstName, email });
    if (success) {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.errorMessage = 'Impossible de créer le compte.';
    }
  }
}