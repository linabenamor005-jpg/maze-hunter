import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('homeCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private kongModel!: THREE.Group;
  private mixer!: THREE.AnimationMixer;
  private animationId: number | null = null;
  private lastTs = 0;
  private kongJawBone: THREE.Object3D | null = null;
  private kongArmLBone: THREE.Object3D | null = null;
  private kongArmRBone: THREE.Object3D | null = null;
  private diskMat!: THREE.MeshStandardMaterial;
  private frontL!: THREE.DirectionalLight;
  private backL!: THREE.PointLight;
  private rimL!: THREE.PointLight;
  private rimL2!: THREE.PointLight;
  private botL!: THREE.PointLight;

  private readonly DISK_Y = -1.85;
  private readonly KONG_SCALE = 0.9;

  // ===== UI state =====
  menuOpen = false;
  contactForm: FormGroup;
  contactSent = false;

  constructor(private router: Router, private auth: AuthService, private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      subject: [''],
      message: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // nothing here
  }

  ngAfterViewInit(): void {
    this.initHomeScene();
    this.createEmbers();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) this.renderer.dispose();
    window.removeEventListener('resize', this.onResize);
  }

  private initHomeScene(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0.5, 6.5);
    this.camera.lookAt(0, -0.1, 0);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0x552200, 1.2));
    this.frontL = new THREE.DirectionalLight(0xff9966, 2.5);
    this.frontL.position.set(0, 3, 5);
    this.frontL.castShadow = true;
    this.scene.add(this.frontL);
    this.backL = new THREE.PointLight(0xff4400, 3, 12);
    this.backL.position.set(0, 2, -4);
    this.scene.add(this.backL);
    this.rimL = new THREE.PointLight(0xff6600, 2, 8);
    this.rimL.position.set(3, 1, 1);
    this.scene.add(this.rimL);
    this.rimL2 = new THREE.PointLight(0xff2200, 2, 8);
    this.rimL2.position.set(-3, 1, 1);
    this.scene.add(this.rimL2);
    this.botL = new THREE.PointLight(0xff8800, 1.5, 5);
    this.botL.position.set(0, -1.5, 2);
    this.scene.add(this.botL);

    // Ground glow disk
    const diskGeo = new THREE.CircleGeometry(1.8, 64);
    this.diskMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.5,
      roughness: 0.8
    });
    const disk = new THREE.Mesh(diskGeo, this.diskMat);
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = this.DISK_Y;
    this.scene.add(disk);

    // Load King Kong model
    this.loadKingKong();

    this.lastTs = performance.now();
    this.animate();
  }

  private loadKingKong(): void {
    const loader = new GLTFLoader();
    loader.load(
      'assets/models/king_kong_2005/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        this.setupKong(model);
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.kongModel);
          const action = this.mixer.clipAction(gltf.animations[0]);
          action.setEffectiveWeight(0.05);
          action.play();
        }
      },
      undefined,
      (err) => {
        console.warn('Kong model not found — using fallback geometry', err);
        const fallback = this.buildFallbackKong();
        this.setupKong(fallback);
      }
    );
  }

  private setupKong(model: THREE.Group): void {
    model.visible = false;
    model.scale.setScalar(this.KONG_SCALE);
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const minY = box.min.y;
    model.position.x = -center.x;
    model.position.z = -center.z;
    model.position.y = this.DISK_Y - minY;

    model.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Search for bones
    model.traverse((obj: any) => {
      if (!obj.isBone && !obj.isObject3D) return;
      const n = obj.name.toLowerCase();
      if (!this.kongJawBone && (n.includes('jaw') || n.includes('mandible') || n.includes('lowerjaw') || n.includes('mouth'))) {
        this.kongJawBone = obj;
      }
      if (!this.kongArmLBone && (n.includes('upperarm') || n.includes('clavicle') || n.includes('shoulder')) && (n.includes('_l') || n.endsWith('l') || n.includes('left'))) {
        this.kongArmLBone = obj;
      }
      if (!this.kongArmRBone && (n.includes('upperarm') || n.includes('clavicle') || n.includes('shoulder')) && (n.includes('_r') || n.endsWith('r') || n.includes('right'))) {
        this.kongArmRBone = obj;
      }
    });

    // Add glow light
    const glow = new THREE.PointLight(0xff6600, 2.0, 6);
    glow.name = 'kongGlow';
    glow.position.set(0, 0.5, 0.5);
    model.add(glow);

    this.scene.add(model);
    this.kongModel = model;
    model.visible = true;

    this.frameKongInView(model);
  }

  /**
   * Recalcule dynamiquement la position de la caméra en fonction de la vraie
   * bounding box du modèle chargé (le modèle GLTF réel n'a pas forcément les
   * mêmes proportions que celles supposées à l'origine, ce qui coupait les
   * pieds à l'écran). On garde un léger angle "héroïque" en visant un peu
   * en dessous du centre, tout en garantissant que la tête ET les pieds
   * restent dans le cadre, avec une marge de sécurité.
   */
  private frameKongInView(model: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const margin = 1.42; // marge de sécurité augmentée pour garder la tête sous la topbar
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const distanceForHeight = (size.y * margin) / (2 * Math.tan(fovRad / 2));
    const distanceForWidth = (size.x * margin) / (2 * Math.tan(fovRad / 2) * this.camera.aspect);
    const distance = Math.max(distanceForHeight, distanceForWidth, 4);

    // Caméra légèrement en dessous du centre pour garder l'angle "héroïque"
    // d'origine, mais toujours assez haute/reculée pour cadrer le corps entier.
    const camY = box.min.y + size.y * 0.42;
    this.camera.position.set(0, camY, distance);
    this.camera.lookAt(0, center.y - size.y * 0.06, 0);
    this.camera.updateProjectionMatrix();
  }

  private buildFallbackKong(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.8, metalness: 0.1 });
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff1100, emissiveIntensity: 2 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.2, 16, 32), mat);
    body.position.y = 0.2;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), mat);
    head.position.y = 1.4;
    group.add(head);

    const jawPivot = new THREE.Object3D();
    jawPivot.position.set(0, 1.12, 0.2);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.32), mat);
    jaw.position.set(0, -0.07, 0.06);
    jawPivot.add(jaw);
    group.add(jawPivot);
    this.kongJawBone = jawPivot;

    [[-0.15, 1.46, 0.38], [0.15, 1.46, 0.38]].forEach(p => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), eyeM);
      e.position.set(p[0], p[1], p[2]);
      group.add(e);
    });

    const armLPivot = new THREE.Object3D();
    armLPivot.position.set(-0.62, 0.55, 0);
    const armLMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 8, 16), mat);
    armLMesh.position.set(-0.16, -0.45, 0);
    armLMesh.rotation.z = 0.4;
    armLPivot.add(armLMesh);
    group.add(armLPivot);
    this.kongArmLBone = armLPivot;

    const armRPivot = new THREE.Object3D();
    armRPivot.position.set(0.62, 0.55, 0);
    const armRMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 8, 16), mat);
    armRMesh.position.set(0.16, -0.45, 0);
    armRMesh.rotation.z = -0.4;
    armRPivot.add(armRMesh);
    group.add(armRPivot);
    this.kongArmRBone = armRPivot;

    const legGeo = new THREE.CapsuleGeometry(0.22, 0.8, 8, 16);
    [-0.3, 0.3].forEach(x => {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(x, -0.8, 0);
      group.add(leg);
    });

    const footMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00 });
    [-0.3, 0.3].forEach(x => {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.5), footMat);
      foot.position.set(x, -1.2, 0.1);
      group.add(foot);
    });

    return group;
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min((now - this.lastTs) / 1000, 0.05);
    this.lastTs = now;
    const t = now / 1000;

    if (this.mixer) this.mixer.update(dt);

    // Animate lights
    this.frontL.intensity = 2.2 + Math.sin(t * 2.2) * 0.4;
    this.backL.intensity = 2.5 + Math.sin(t * 3.1) * 0.8;
    this.rimL.intensity = 1.8 + Math.sin(t * 2.7) * 0.6;
    this.rimL2.intensity = 1.8 + Math.cos(t * 2.7) * 0.6;
    this.botL.intensity = 1.2 + Math.sin(t * 4.0) * 0.4;
    this.diskMat.emissiveIntensity = 0.9 + Math.sin(t * 3.0) * 0.35;

    if (!this.kongModel) return;

    // Rotate Kong slowly
    this.kongModel.rotation.y = Math.sin(t * 0.22) * 0.35;

    // Glow pulse
    const glow = this.kongModel.getObjectByName('kongGlow');
    if (glow) (glow as THREE.PointLight).intensity = 1.8 + Math.sin(t * 3.5) * 0.7;

    // Chest beating animation
    // (kept exactly as original)
    const CHEST_PERIOD = 3.2;
    const CHEST_DURATION = 1.0;
    // We need to maintain state across frames. I'll keep it as simple variables inside the function.
    // Since we need persistent state, we'll attach to component properties.
    if (!this._chestTimer) this._chestTimer = CHEST_PERIOD * 0.5;
    if (!this._beating) this._beating = false;
    if (!this._beatPhase) this._beatPhase = 0;

    if (!this._beating) {
      this._chestTimer -= dt;
      if (this._chestTimer <= 0) {
        this._beating = true;
        this._beatPhase = 0;
      }
    }
    if (this._beating) {
      this._beatPhase += dt / CHEST_DURATION;
      const p = Math.min(this._beatPhase, 1.0);
      const armCurve = Math.sin(p * Math.PI);
      if (this.kongArmLBone && this._armLRest) {
        this.kongArmLBone.rotation.z = this._armLRest.z + armCurve * -1.4;
        this.kongArmLBone.rotation.x = this._armLRest.x + armCurve * 0.6;
      }
      if (this.kongArmRBone && this._armRRest) {
        this.kongArmRBone.rotation.z = this._armRRest.z + armCurve * 1.4;
        this.kongArmRBone.rotation.x = this._armRRest.x + armCurve * 0.6;
      }
      if (this.kongJawBone && this._jawRest) {
        const mOpen = p < 0.5 ? (p / 0.5) * 0.65 : (1.0 - (p - 0.5) / 0.5) * 0.65;
        this.kongJawBone.rotation.x = this._jawRest.x + mOpen;
      }
      this.kongModel.position.z = Math.sin(p * Math.PI) * 0.12;
      if (p >= 1.0) {
        this._beating = false;
        this._beatPhase = 0;
        this._chestTimer = CHEST_PERIOD;
        if (this.kongArmLBone && this._armLRest) this.kongArmLBone.rotation.copy(this._armLRest);
        if (this.kongArmRBone && this._armRRest) this.kongArmRBone.rotation.copy(this._armRRest);
        if (this.kongJawBone && this._jawRest) this.kongJawBone.rotation.copy(this._jawRest);
        this.kongModel.position.z = 0;
      }
    }

    // Store initial rotations if not stored yet
    if (!this._jawRest && this.kongJawBone) {
      this._jawRest = this.kongJawBone.rotation.clone();
      this._armLRest = this.kongArmLBone ? this.kongArmLBone.rotation.clone() : new THREE.Euler();
      this._armRRest = this.kongArmRBone ? this.kongArmRBone.rotation.clone() : new THREE.Euler();
    }

    this.renderer.render(this.scene, this.camera);
  };

  // Animation state properties
  private _chestTimer: number = 1.6;
  private _beating: boolean = false;
  private _beatPhase: number = 0;
  private _jawRest: THREE.Euler | null = null;
  private _armLRest: THREE.Euler | null = null;
  private _armRRest: THREE.Euler | null = null;

  // ===== Embers =====
  private createEmbers(): void {
    const container = document.getElementById('home-embers');
    if (!container) return;
    for (let i = 0; i < 40; i++) {
      const e = document.createElement('div');
      e.className = 'ember';
      const size = 2 + Math.random() * 5;
      const hue = 10 + Math.random() * 30;
      e.style.cssText = `
        width:${size}px; height:${size}px;
        background: hsl(${hue},100%,${50+Math.random()*30}%);
        box-shadow: 0 0 ${size*2}px hsl(${hue},100%,60%);
        left: ${Math.random() * 100}%;
        bottom: ${Math.random() * 30}%;
        --drift: ${(Math.random()-0.5)*60}px;
        animation-duration: ${3 + Math.random() * 5}s;
        animation-delay: ${-Math.random() * 6}s;
      `;
      container.appendChild(e);
    }
  }

  // ===== NAVIGATION =====
  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToAdmin(): void {
    this.router.navigate(['/admin/login']);
  }

  goToSignup(): void {
    this.router.navigate(['/signup']);
  }

  goToTesting(): void {
    // Connecté → /test, sinon → /login
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/test']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  private onResize = (): void => {
    if (this.camera && this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  // ===== Smooth scroll to section =====
  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== Contact form =====
  onContactSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }
    // TODO: brancher sur un service d'envoi (backend / email) une fois disponible.
    console.log('Contact form submitted:', this.contactForm.value);
    this.contactSent = true;
    this.contactForm.reset();
    setTimeout(() => (this.contactSent = false), 5000);
  }
}