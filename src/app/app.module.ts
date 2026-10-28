import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { routes } from './app.routes';

import { AppComponent } from './app.component';
import { HomeComponent } from './pages/home/home';
import { LoginComponent } from './pages/login/login';
import { SignupComponent } from './pages/signup/signup';
import { TestComponent } from './pages/test/test';
import { GameComponent } from './pages/game/game';
import { PvtEditorComponent } from './components/pvt-editor/pvt-editor.component';
import { FinalReportEditorComponent } from './components/final-report-editor/final-report-editor.component';
import { AdminLoginComponent } from './pages/admin/admin-login/admin-login';
import { AdminSignupComponent } from './pages/admin/admin-signup/admin-signup';
import { AdminDashboardComponent } from './pages/admin/admin-dashboard/admin-dashboard';

import { AuthService } from './core/services/auth';
import { BugService } from './core/services/bug';
import { GameStateService } from './core/services/game-state';
import { ThreeLoaderService } from './core/services/three-loader';
import { AuthGuard } from './core/guards/auth-guard';
import { AdminAuthService } from './core/services/admin-auth';
import { AdminGuard } from './core/guards/admin-guard';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    LoginComponent,
    SignupComponent,
    TestComponent,
    GameComponent,
    PvtEditorComponent,
    FinalReportEditorComponent,
    AdminLoginComponent,
    AdminSignupComponent,
    AdminDashboardComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot(routes)
  ],
  providers: [
    AuthService,
    BugService,
    GameStateService,
    ThreeLoaderService,
    AuthGuard,
    AdminAuthService,
    AdminGuard
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }