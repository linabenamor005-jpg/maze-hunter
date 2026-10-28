import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LoginComponent } from './pages/login/login';
import { SignupComponent } from './pages/signup/signup';
import { TestComponent } from './pages/test/test';
import { GameComponent } from './pages/game/game';
import { AuthGuard } from './core/guards/auth-guard';
import { PvtEditorComponent } from './components/pvt-editor/pvt-editor.component';
import { FinalReportEditorComponent } from './components/final-report-editor/final-report-editor.component';
import { AdminLoginComponent } from './pages/admin/admin-login/admin-login';
import { AdminSignupComponent } from './pages/admin/admin-signup/admin-signup';
import { AdminDashboardComponent } from './pages/admin/admin-dashboard/admin-dashboard';
import { AdminGuard } from './core/guards/admin-guard';

export const routes: Routes = [
  { path: 'pvt', component: PvtEditorComponent },
  { path: 'final', component: FinalReportEditorComponent },
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'test', component: TestComponent, canActivate: [AuthGuard] },
  { path: 'game', component: GameComponent, canActivate: [AuthGuard] },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin/signup', component: AdminSignupComponent },
  { path: 'admin/dashboard', component: AdminDashboardComponent, canActivate: [AdminGuard] },
  { path: '**', redirectTo: '' }
];