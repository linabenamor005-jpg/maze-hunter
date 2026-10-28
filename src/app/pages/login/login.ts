import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  loginForm: FormGroup;

  constructor(private fb: FormBuilder, private auth: AuthService, public router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      const success = this.auth.login(email, password);
      if (success) {
        alert('✅ Connexion simulée !\nBienvenue dans MAZE HUNTER.');
        // Rediriger vers la page test après connexion
        this.router.navigate(['/test']);
      } else {
        alert('❌ Erreur de connexion.');
      }
    }
  }
}