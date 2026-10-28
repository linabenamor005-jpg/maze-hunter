import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-signup',
  standalone: false,
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss']
})
export class SignupComponent implements OnInit, OnDestroy {
  @ViewChild('bgCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  signupForm: FormGroup;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private particles!: THREE.Points;
  private animationId: number | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService, public router: Router) {
    this.signupForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      terms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.initThree();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) this.renderer.dispose();
    window.removeEventListener('resize', this.onResize);
  }

  // Validateur personnalisé : vérifie que password et confirmPassword correspondent
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0300);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0.8, 5);
    this.camera.lookAt(0, 0.5, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Lumières
    this.scene.add(new THREE.AmbientLight(0x442200, 0.8));
    const mainL = new THREE.DirectionalLight(0xff8844, 1.5);
    mainL.position.set(0, 3, 5);
    this.scene.add(mainL);
    const backL = new THREE.PointLight(0xff4400, 2, 15);
    backL.position.set(0, 2, -3);
    this.scene.add(backL);
    const rimL = new THREE.PointLight(0xff6600, 1.5, 10);
    rimL.position.set(3, 1, 2);
    this.scene.add(rimL);
    const rimL2 = new THREE.PointLight(0xff2200, 1.5, 10);
    rimL2.position.set(-3, 1, 2);
    this.scene.add(rimL2);

    // Particules (fumée)
    const pCount = 400;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i*3] = (Math.random() - 0.5) * 12;
      pPos[i*3+1] = Math.random() * 4 - 0.5;
      pPos[i*3+2] = (Math.random() - 0.5) * 12 - 2;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xff5500,
      size: 0.08,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    this.particles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.particles);

    this.animate();
  }

  private animate = (): void => {
    if (!this.renderer) return;
    this.animationId = requestAnimationFrame(this.animate);
    this.particles.rotation.y += 0.002;
    this.renderer.render(this.scene, this.camera);
  };

  onResize = (): void => {
    if (this.camera && this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  onSubmit(): void {
    if (this.signupForm.valid) {
      const { email, firstName } = this.signupForm.value;
      const success = this.auth.signup({ email, firstName });
      if (success) {
        alert('✅ Compte créé avec succès !\nBienvenue dans MAZE HUNTER.');
        // L'utilisateur est maintenant authentifié : direction /test
        this.router.navigate(['/test']);
      } else {
        alert('❌ Erreur lors de la création du compte.');
      }
    }
  }
}