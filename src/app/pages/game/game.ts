import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BugStateService, Bug } from '../../core/services/bug-state.service';

// ── COMPATIBILITÉ D'ÉCLAIRAGE ──────────────────────────────────
// L'original tournait sur Three.js r150. Ce projet utilise Three.js 0.185,
// où l'éclairage "physiquement correct" est désormais permanent : les
// PointLight/SpotLight sont exprimées en candela et paraissent ~4π fois
// plus sombres qu'avant pour la même valeur numérique. On désactive la
// gestion de couleur automatique (comportement r150) et on compense
// uniquement les PointLight ci-dessous pour retrouver l'éclat d'origine,
// sans toucher à la lumière directionnelle/ambiante (mode nuit inchangé).
THREE.ColorManagement.enabled = false;
const POINT_LIGHT_COMPENSATION = 4 * Math.PI;

interface BugInfo {
  id: string;
  name: string;
  priority: string;
}

interface CollectParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface GameSync {
  kongPower: number;
  testsPassed: number;
  money: number;
  fixedBugs: string[];
  level: number;
}

@Component({
  selector: 'app-game',
  standalone: false,
  templateUrl: './game.html',
  styleUrls: ['./game.scss']
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  // ── HUD (bindings publiques) ─────────────────────────────────
  hp = 100;
  bugsCollected = 0;
  totalBugs = 0;           // sera mis à jour dynamiquement
  level = 1;
  money = 0;
  timer = 90;

  toastIcon = '🎁';
  toastText = '';
  toastActive = false;

  bugOverlayActive = false;
  bugDetailsText = 'BUG-031 — Injection SQL';

  gameOverActive = false;
  gameWinActive = false;
  goScoreText = '0 bugs catchés';
  winTimeText = 'Time: 0s';

  mobileControlsActive = true;
  dpPressed: { [k: string]: boolean } = { u: false, d: false, l: false, r: false };

  // ── SYNC ──────────────────────────────────────────────────────
  private SYNC_KEY = 'mazeHunterSync';
  gameSync: GameSync = { kongPower: 1, testsPassed: 0, money: 0, fixedBugs: [], level: 1 };

  // ── GLOBALES (équivalent des variables du script original) ─────
  private gameActive = false;
  private gameAnimId: number | null = null;
  private gameTimerInt: any = null;
  private gameKeys: { [key: string]: boolean } = {};
  private mobileKeys: { [key: string]: boolean } = {};
  private gameBugsCount = 0;
  private gameHp = 100;
  private gameRage = 1;
  private gameTimer = 90;
  private gameKongSpeed = 2.5;
  private lastTs = 0;
  private bugAnimT = 0;
  private runCycle = 0;
  private collectParticles: CollectParticle[] = [];
  private gameMoney = 0;
  private gameLevel = 1;
  private pendingBugIndex = -1;
  private pendingBugId: string | null = null;
  private gameBugMeshes: THREE.Group[] = [];
  private gameRenderer!: THREE.WebGLRenderer;
  private gameScene!: THREE.Scene;
  private gameCamera!: THREE.PerspectiveCamera;
  private gamePlayer!: THREE.Group | null;
  private fallbackMeshes: THREE.Object3D[] = [];
  private kongModel: THREE.Group | null = null;
  private kongBones: any = {};
  private smoothSway = 0;
  private smoothTwist = 0;
  private transitionT = 0;
  private gltfLoader = new GLTFLoader();

  // ── Données des bugs (depuis l'API) ──────────────────────────
  private bugsFromApi: Bug[] = [];

  // ── MAZE ──────────────────────────────────────────────────────
  private readonly MAZE_COLS = 15;
  private readonly MAZE_ROWS = 11;
  private readonly CELL = 5;
  private readonly MAZE = [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,1,0,0,0,0,0,0,0,1,0,1,
    1,0,1,0,1,0,1,1,0,1,1,0,1,0,1,
    1,0,1,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,
    1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,
    1,1,1,0,1,1,1,1,1,0,1,0,1,1,1,
    1,0,0,0,1,0,0,0,0,0,0,0,1,0,1,
    1,0,1,0,0,0,1,0,1,0,1,0,0,0,1,
    1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
  ];

  private readonly BUG_DATA: BugInfo[] = [
    { id: 'BUG-031', name: 'Injection SQL bypass auth', priority: 'CRITIQUE' },
    { id: 'BUG-029', name: 'XSS champ commentaire', priority: 'CRITIQUE' },
    { id: 'BUG-030', name: 'Timeout API /search', priority: 'HIGH' },
    { id: 'BUG-022', name: 'Erreur affichage tableau', priority: 'MEDIUM' },
    { id: 'BUG-018', name: 'Crash menu mobile', priority: 'HIGH' },
    { id: 'BUG-014', name: 'Cache invalide dashboard', priority: 'MEDIUM' },
    { id: 'BUG-027', name: 'Mauvais format de date', priority: 'LOW' },
    { id: 'BUG-009', name: 'Doublon de notification', priority: 'LOW' },
    { id: 'BUG-033', name: 'Fuite mémoire au scroll', priority: 'MEDIUM' },
    { id: 'BUG-005', name: 'Bouton inactif sur Safari', priority: 'HIGH' }
  ];

  private toastTimeout: any = null;
  private resizeHandler = () => this.onResize();

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private bugState: BugStateService   // injection du service
  ) {}

  // En zoneless, les callbacks natifs ne déclenchent pas automatiquement le rafraîchissement
  private refresh(): void {
    if (!this.cdr) return;
    try { this.cdr.detectChanges(); } catch (_) { /* vue en cours de destruction */ }
  }

  // ── LIFECYCLE ────────────────────────────────────────────────
  ngOnInit(): void {
    this.gameSync = this.loadSync();
    (window as any).gameSync = this.gameSync;
    this.gameMoney = this.gameSync.money || 0;
    this.gameLevel = this.gameSync.level || 1;

    // Expositions sur window
    (window as any).goBackToTesting = () => this.goBackToTesting();
    (window as any).testBugNow = () => this.testBugNow();
    (window as any).restartGame = () => this.restartGame();
    (window as any).dpDown = (k: string) => this.dpDown(k);
    (window as any).dpUp = (k: string) => this.dpUp(k);

    // Charger les bugs depuis l'API
    this.bugState.loadBugs();
    this.bugState.bugs$.subscribe((bugs: Bug[]) => {
      this.bugsFromApi = bugs;
      if (this.gameActive && this.gameScene) {
        this.rebuildBugs();
        this.updateGameHUD();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initGame();
  }

  ngOnDestroy(): void {
    this.cleanupGame();
    if (this.gameAnimId) cancelAnimationFrame(this.gameAnimId);
    window.removeEventListener('resize', this.resizeHandler);
    if (this.gameRenderer) this.gameRenderer.dispose();
  }

  // ── SYNC ──────────────────────────────────────────────────────
  private loadSync(): GameSync {
    try {
      const p = JSON.parse(localStorage.getItem(this.SYNC_KEY) || '{}');
      return {
        kongPower: p.kongPower || 1,
        testsPassed: p.testsPassed || 0,
        money: p.money || 0,
        fixedBugs: Array.isArray(p.fixedBugs) ? p.fixedBugs : [],
        level: p.level || 1
      };
    } catch (_) {
      return { kongPower: 1, testsPassed: 0, money: 0, fixedBugs: [], level: 1 };
    }
  }

  private saveSync(sync: GameSync): void {
    localStorage.setItem(this.SYNC_KEY, JSON.stringify(sync));
  }

  // ── MAZE HELPERS ─────────────────────────────────────────────
  private isWall(x: number, z: number): boolean {
    const col = Math.floor(x / this.CELL + this.MAZE_COLS / 2);
    const row = Math.floor(z / this.CELL + this.MAZE_ROWS / 2);
    if (col < 0 || col >= this.MAZE_COLS || row < 0 || row >= this.MAZE_ROWS) return true;
    return this.MAZE[row * this.MAZE_COLS + col] === 1;
  }

  private getRandomPosition(): THREE.Vector3 {
    for (let i = 0; i < 200; i++) {
      const col = 2 + Math.floor(Math.random() * (this.MAZE_COLS - 4));
      const row = 2 + Math.floor(Math.random() * (this.MAZE_ROWS - 4));
      if (this.MAZE[row * this.MAZE_COLS + col] === 0) {
        const x = (col - this.MAZE_COLS / 2) * this.CELL + this.CELL / 2;
        const z = (row - this.MAZE_ROWS / 2) * this.CELL + this.CELL / 2;
        if (Math.hypot(x - (-this.MAZE_COLS / 2 + 1.5) * this.CELL, z - (-this.MAZE_ROWS / 2 + 1.5) * this.CELL) > 15) {
          return new THREE.Vector3(x, 0, z);
        }
      }
    }
    return new THREE.Vector3(0, 0, 0);
  }

  // ── ARBRE MORT ──────────────────────────────────────────────
  private addDeadTree(scene: THREE.Scene, x: number, z: number): void {
    // ... (identique à votre code original)
    // Je le mets en version courte pour éviter de surcharger, mais tu peux reprendre ta version complète.
    const group = new THREE.Group();
    const deadMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.98, metalness: 0.0 });
    const h = 3.0 + Math.random() * 4.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, h, 6), deadMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.5;
    trunk.rotation.x = (Math.random() - 0.5) * 0.3;
    trunk.castShadow = true;
    group.add(trunk);
    const branchCount = 4 + Math.floor(Math.random() * 6);
    for (let b = 0; b < branchCount; b++) {
      const bh = 0.6 + Math.random() * 2.5;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, bh, 4), deadMat);
      const heightRatio = 0.3 + Math.random() * 0.5;
      const angle = (b / branchCount) * Math.PI * 2 + Math.random() * 0.8;
      const tiltOut = Math.PI / 3 + Math.random() * 0.6;
      branch.position.y = h * heightRatio;
      branch.position.x = Math.cos(angle) * 0.2;
      branch.position.z = Math.sin(angle) * 0.2;
      branch.rotation.z = Math.cos(angle) * tiltOut;
      branch.rotation.x = Math.sin(angle) * tiltOut * 0.5;
      branch.castShadow = true;
      group.add(branch);
      if (Math.random() > 0.3) {
        const sbh = 0.3 + Math.random() * 0.8;
        const sub = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.04, sbh, 3), deadMat);
        sub.position.y = bh * 0.6;
        sub.rotation.z = (Math.random() - 0.5) * 0.9;
        branch.add(sub);
      }
    }
    group.position.set(x + (Math.random() - 0.5) * 0.8, 0, z + (Math.random() - 0.5) * 0.8);
    group.rotation.y = Math.random() * Math.PI * 2;
    const sc = 0.8 + Math.random() * 1.0;
    group.scale.set(sc, sc, sc);
    scene.add(group);
  }

  // ── ARBRE VIVANT ──────────────────────────────────────────────
  private addLiveTree(scene: THREE.Scene, x: number, z: number): void {
    // ... (identique à votre code original)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x0d1a0d, roughness: 0.8 });
    const tree = new THREE.Group();
    const h = 2.5 + Math.random() * 4.0;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 + Math.random() * 0.25, 0.4 + Math.random() * 0.4, h, 6), trunkMat);
    trunk.position.y = h / 2;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.0 + Math.random() * 0.9, 6, 6), leavesMat);
    crown.position.y = h + 0.5;
    crown.scale.y = 0.8 + Math.random() * 0.6;
    tree.add(crown);
    tree.position.set(x + (Math.random() - 0.5) * 0.5, 0, z + (Math.random() - 0.5) * 0.5);
    tree.rotation.y = Math.random() * Math.PI * 2;
    const sc = 0.8 + Math.random() * 0.9;
    tree.scale.set(sc, sc, sc);
    tree.traverse((c: any) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(tree);
  }

  // ── REBUILD BUGS (à partir des données de l'API) ────────────
  private rebuildBugs(): void {
    // Supprimer les anciens meshes
    this.gameBugMeshes.forEach(bug => this.gameScene.remove(bug));
    this.gameBugMeshes = [];

    const bugs = this.bugsFromApi.filter(b => b.status !== 'FIXED'); // seulement les ouverts
    if (bugs.length === 0) {
      this.updateGameHUD();
      return;
    }

    // Générer des positions aléatoires pour chaque bug
    const bugPositions: THREE.Vector3[] = [];
    for (let i = 0; i < bugs.length; i++) {
      bugPositions.push(this.getRandomPosition());
    }

    // Fonction de spawn (identique à l'original, avec chargement du modèle)
    const spawnBugs = (modelOrNull: any) => {
      const bugMat = new THREE.MeshStandardMaterial({ color: 0xff2255, emissive: 0xff0033, emissiveIntensity: 2 });
      bugs.forEach((bug, idx) => {
        const grp = new THREE.Group();
        if (modelOrNull) {
          const model = modelOrNull.scene.clone(true);
          const b = new THREE.Box3().setFromObject(model);
          const s = new THREE.Vector3();
          b.getSize(s);
          model.scale.setScalar(1.4 / Math.max(s.x, s.y, s.z));
          const b2 = new THREE.Box3().setFromObject(model);
          const c2 = new THREE.Vector3();
          b2.getCenter(c2);
          model.position.x -= c2.x;
          model.position.z -= c2.z;
          model.position.y -= b2.min.y;
          model.traverse((c: any) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
          grp.add(model);
        } else {
          // fallback cube
          const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.4), bugMat);
          body.position.y = 0.4;
          body.castShadow = true;
          grp.add(body);
        }
        const bLight = new THREE.PointLight(0xff2255, 1.5 * POINT_LIGHT_COMPENSATION, 4);
        bLight.position.set(0, 0.5, 0);
        grp.add(bLight);
        const pos = bugPositions[idx] || this.getRandomPosition();
        grp.position.copy(pos);
        grp.position.y = 0;
        grp.rotation.y = Math.random() * Math.PI * 2;
        const angle = Math.random() * Math.PI * 2;
        (grp.userData as any) = {
          bugId: bug.id,
          bugName: bug.name,
          priority: bug.priority,
          isTestable: true,
          speed: 0.3 + Math.random() * 0.4,
          dirX: Math.cos(angle),
          dirZ: Math.sin(angle)
        };
        this.gameScene.add(grp);
        this.gameBugMeshes.push(grp);
      });
      this.updateGameHUD();
    };

    // Charger le modèle bug (ou fallback)
    this.gltfLoader.load('assets/models/bug/scene.gltf', spawnBugs, undefined, () => spawnBugs(null));
  }

  // ── INIT GAME ────────────────────────────────────────────────
  private initGame(): void {
    this.gameBugsCount = 0;
    this.gameHp = 100;
    this.gameRage = 1;
    this.gameTimer = 90;
    this.gameKongSpeed = 2.5 + (this.gameLevel - 1) * 0.5;
    this.gameBugMeshes = [];
    this.collectParticles = [];
    this.kongModel = null;
    this.kongBones = {};
    this.smoothSway = 0;
    this.smoothTwist = 0;
    this.transitionT = 0;
    this.runCycle = 0;
    this.lastTs = performance.now();

    if (this.gameTimerInt) clearInterval(this.gameTimerInt);
    this.gameTimerInt = setInterval(() => {
      if (!this.gameActive) return;
      this.gameTimer--;
      this.timer = this.gameTimer;
      if (this.gameTimer <= 0) {
        this.gameTimer = 0;
        this.timer = 0;
        this.triggerGameOver();
      }
      this.refresh();
    }, 1000);

    // --- Renderer ---
    const canvasEl = this.canvasRef?.nativeElement;
    if (!canvasEl) {
      console.error('Canvas non trouvé !');
      return;
    }
    this.gameRenderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    this.gameRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gameRenderer.shadowMap.enabled = true;
    this.gameRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.gameRenderer.toneMappingExposure = 0.8;
    this.gameRenderer.setSize(window.innerWidth, window.innerHeight);

    this.gameScene = new THREE.Scene();
    this.gameScene.background = new THREE.Color(0x0d0a1a);
    this.gameScene.fog = new THREE.FogExp2(0x0d0a1a, 0.012);
    this.gameCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);

    // --- Lights (originales avec compensation) ---
    this.gameScene.add(new THREE.AmbientLight(0x334466, 0.5));
    const moon = new THREE.DirectionalLight(0x88bbff, 1.5);
    moon.position.set(-10, 20, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -30;
    moon.shadow.camera.right = 30;
    moon.shadow.camera.top = 30;
    moon.shadow.camera.bottom = -30;
    moon.shadow.camera.far = 80;
    this.gameScene.add(moon);
    const fill = new THREE.DirectionalLight(0x445577, 0.5);
    fill.position.set(10, 5, -10);
    this.gameScene.add(fill);
    const rim = new THREE.PointLight(0x6633aa, 0.6 * POINT_LIGHT_COMPENSATION, 30);
    rim.position.set(-15, 3, -20);
    this.gameScene.add(rim);

    // --- Ground ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.MAZE_COLS * this.CELL * 1.6, this.MAZE_ROWS * this.CELL * 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.gameScene.add(ground);

    // --- Arbres ---
    for (let r = 0; r < this.MAZE_ROWS; r++) {
      for (let c = 0; c < this.MAZE_COLS; c++) {
        if (this.MAZE[r * this.MAZE_COLS + c] === 1) {
          const px = (c - this.MAZE_COLS / 2) * this.CELL + this.CELL / 2;
          const pz = (r - this.MAZE_ROWS / 2) * this.CELL + this.CELL / 2;
          if (Math.random() < 0.45) this.addDeadTree(this.gameScene, px, pz);
          else this.addLiveTree(this.gameScene, px, pz);
        }
      }
    }
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2, r = 15 + Math.random() * 35;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      if (Math.random() < 0.5) this.addDeadTree(this.gameScene, px, pz);
      else this.addLiveTree(this.gameScene, px, pz);
    }

    // --- Rochers ---
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 30;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.6, 0), rockMat);
      rock.position.set(Math.cos(a) * r + Math.random() * 0.5, 0.1, Math.sin(a) * r + Math.random() * 0.5);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.scale.y = 0.4 + Math.random() * 0.6;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.gameScene.add(rock);
    }

    // --- Joueur fallback (masqué) ---
    this.gamePlayer = new THREE.Group();
    const sphMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.6, roughness: 0.3 });
    const sph = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), sphMat);
    sph.position.y = 0.7;
    sph.castShadow = true;
    sph.visible = false;
    this.gamePlayer.add(sph);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.1, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 0.3 }));
    ring.position.y = 1.2;
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    this.gamePlayer.add(ring);
    this.fallbackMeshes = [sph, ring];
    const pLight = new THREE.PointLight(0xff8800, 2.5 * POINT_LIGHT_COMPENSATION, 8);
    pLight.position.set(0, 1.5, 0);
    this.gamePlayer.add(pLight);
    this.gamePlayer.position.set((-this.MAZE_COLS / 2 + 1.5) * this.CELL, 0, (-this.MAZE_ROWS / 2 + 1.5) * this.CELL);
    this.gameScene.add(this.gamePlayer);

    // --- Bugs (initial) ---
    this.rebuildBugs();

    // --- King Kong ---
    this.gltfLoader.load('assets/models/king_kong_2005/scene.gltf', (gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const b0 = new THREE.Box3().setFromObject(model);
      const s0 = new THREE.Vector3();
      b0.getSize(s0);
      const maxD = Math.max(s0.x, s0.y, s0.z);
      if (maxD > 0) model.scale.setScalar(3.5 / maxD);

      model.updateMatrixWorld(true);
      const b1 = new THREE.Box3().setFromObject(model);
      model.position.x -= (b1.min.x + b1.max.x) / 2;
      model.position.z -= (b1.min.z + b1.max.z) / 2;

      model.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(model);
      const minY = b2.min.y;
      if (minY < 0) model.position.y -= minY;
      else model.position.y = 0;

      model.traverse((c: any) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

      if (this.gamePlayer) {
        while (this.gamePlayer.children.length) this.gamePlayer.remove(this.gamePlayer.children[0]);
        this.gamePlayer.add(model);
        const kLight = new THREE.PointLight(0xff8800, 2.5 * POINT_LIGHT_COMPENSATION, 10);
        kLight.position.set(0, 2, 0);
        this.gamePlayer.add(kLight);
      }
      this.kongModel = model;
      console.log('✅ King Kong chargé');
    }, undefined, (err) => {
      console.warn('❌ King Kong fallback (sphère)', err);
      this.fallbackMeshes.forEach(m => (m.visible = true));
    });

    // --- Événements ---
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    this.updateGameHUD();
    this.gameActive = true;
    this.gameAnimId = requestAnimationFrame((ts) => this.gameLoop(ts));
    window.addEventListener('resize', this.resizeHandler);
  }

  // ── INPUT ─────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    this.gameKeys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.gameKeys[e.key] = false;
  };

  dpDown(k: string): void {
    this.mobileKeys[k] = true;
    this.dpPressed[k] = true;
  }
  dpUp(k: string): void {
    this.mobileKeys[k] = false;
    this.dpPressed[k] = false;
  }

  private getMoveInput(): { mx: number; mz: number } {
    let mx = 0, mz = 0;
    if (this.gameKeys['w'] || this.gameKeys['W'] || this.gameKeys['ArrowUp'] || this.mobileKeys['u']) mz -= 1;
    if (this.gameKeys['s'] || this.gameKeys['S'] || this.gameKeys['ArrowDown'] || this.mobileKeys['d']) mz += 1;
    if (this.gameKeys['a'] || this.gameKeys['A'] || this.gameKeys['ArrowLeft'] || this.mobileKeys['l']) mx -= 1;
    if (this.gameKeys['d'] || this.gameKeys['D'] || this.gameKeys['ArrowRight'] || this.mobileKeys['r']) mx += 1;
    return { mx, mz };
  }

  // ── GAME LOOP ──────────────────────────────────────────────────
  private gameLoop(ts: number): void {
    if (!this.gameActive) return;
    this.gameAnimId = requestAnimationFrame((t) => this.gameLoop(t));
    const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
    this.lastTs = ts;
    this.bugAnimT += dt;

    const { mx, mz } = this.getMoveInput();
    const isMoving = (mx !== 0 || mz !== 0);
    const player = this.gamePlayer!;

    // --- Mouvement joueur ---
    if (isMoving) {
      const len = Math.hypot(mx, mz);
      const nx = player.position.x + (mx / len) * this.gameKongSpeed * dt;
      const nz = player.position.z + (mz / len) * this.gameKongSpeed * dt;
      if (!this.isWall(nx, player.position.z)) player.position.x = nx;
      if (!this.isWall(player.position.x, nz)) player.position.z = nz;
      player.rotation.y = Math.atan2(mx, mz);
    }

    // --- Animation King Kong ---
    if (this.kongModel) {
      const targetT = isMoving ? 1.0 : 0.0;
      const blendRate = isMoving ? 0.92 : 0.85;
      this.transitionT = this.lerp(this.transitionT, targetT, blendRate * dt * 6);
      const easeT = this.easeInOut(this.transitionT);
      const strideFreq = isMoving ? this.gameKongSpeed * 1.5 : 0.4;
      this.runCycle += dt * strideFreq;
      const t = this.runCycle;

      this.kongModel.rotation.x = 0;
      const swayRun = Math.sin(t) * 0.025;
      const swayIdle = Math.sin(t * 0.3) * 0.01;
      const targetSway = this.lerp(swayIdle, swayRun, easeT);
      this.smoothSway = this.lerp(this.smoothSway, targetSway, 9 * dt);
      this.kongModel.rotation.z = this.smoothSway;

      const twistRun = Math.sin(t + Math.PI * 0.5) * 0.02;
      const twistIdle = Math.sin(t * 0.25) * 0.005;
      const targetTwist = this.lerp(twistIdle, twistRun, easeT);
      this.smoothTwist = this.lerp(this.smoothTwist, targetTwist, 9 * dt);
      this.kongModel.rotation.y = this.smoothTwist * 0.3;

      // Bones
      if (this.kongModel && !this.kongBones._scanned) {
        this.scanBones(this.kongModel);
        this.kongBones._scanned = true;
        console.log('🦍 Bones détectés:', Object.keys(this.kongBones));
      }
      const easeBone = easeT;
      const phase = t;
      // Animation des membres
      if (this.kongBones.leftArm) {
        this.kongBones.leftArm.rotation.x = Math.sin(phase + Math.PI) * 0.55 * easeBone;
        this.kongBones.leftArm.rotation.z = Math.sin(phase) * 0.06 * easeBone;
      }
      if (this.kongBones.rightArm) {
        this.kongBones.rightArm.rotation.x = Math.sin(phase) * 0.55 * easeBone;
        this.kongBones.rightArm.rotation.z = -Math.sin(phase) * 0.06 * easeBone;
      }
      if (this.kongBones.leftThigh) {
        this.kongBones.leftThigh.rotation.x = Math.sin(phase + Math.PI) * 0.45 * easeBone;
      }
      if (this.kongBones.leftLeg) {
        this.kongBones.leftLeg.rotation.x = Math.max(0, -Math.sin(phase + Math.PI)) * 0.5 * easeBone;
      }
      if (this.kongBones.leftFoot) {
        this.kongBones.leftFoot.rotation.x = -Math.sin(phase + Math.PI) * 0.1 * easeBone;
      }
      if (this.kongBones.rightThigh) {
        this.kongBones.rightThigh.rotation.x = Math.sin(phase) * 0.45 * easeBone;
      }
      if (this.kongBones.rightLeg) {
        this.kongBones.rightLeg.rotation.x = Math.max(0, -Math.sin(phase)) * 0.5 * easeBone;
      }
      if (this.kongBones.rightFoot) {
        this.kongBones.rightFoot.rotation.x = -Math.sin(phase) * 0.1 * easeBone;
      }

      // Correction sol
      const box = new THREE.Box3().setFromObject(this.kongModel);
      if (box.min.y < 0) this.kongModel.position.y -= box.min.y;
      else if (box.min.y > 0.001) this.kongModel.position.y -= box.min.y;
      player.position.y = 0;
    }

    // --- Mouvement des bugs ---
    this.gameBugMeshes.forEach((bug, i) => {
      const spd = (bug.userData as any).speed || 0.35;
      const nx = bug.position.x + (bug.userData as any).dirX * spd * dt;
      const nz = bug.position.z + (bug.userData as any).dirZ * spd * dt;
      if (!this.isWall(nx, bug.position.z)) bug.position.x = nx;
      else (bug.userData as any).dirX *= -1;
      if (!this.isWall(bug.position.x, nz)) bug.position.z = nz;
      else (bug.userData as any).dirZ *= -1;
      bug.position.y = Math.sin(this.bugAnimT * 2.5 + i * 1.3) * 0.10;
      const light = bug.children.find(c => (c as any).isLight);
      if (light) (light as THREE.PointLight).intensity = (1.5 + Math.sin(this.bugAnimT * 3 + i) * 0.8) * POINT_LIGHT_COMPENSATION;
    });

    // --- Capture des bugs (overlay) ---
    for (let i = 0; i < this.gameBugMeshes.length; i++) {
      const dist = player.position.distanceTo(this.gameBugMeshes[i].position);
      if (dist < 1.8) {
        const ud = this.gameBugMeshes[i].userData as any;
        if (ud.isTestable && ud.bugId) {
          this.pendingBugIndex = i;
          this.pendingBugId = ud.bugId;
          this.showBugOverlay(ud.bugId, ud.bugName, ud.priority);
          return;
        }
      }
    }

    // --- Particules ---
    this.updateCollectParticles(dt);

    // --- Caméra ---
    const tCamX = player.position.x;
    const tCamZ = player.position.z + 12;
    const tCamY = 7;
    this.gameCamera.position.x += (tCamX - this.gameCamera.position.x) * 6 * dt;
    this.gameCamera.position.z += (tCamZ - this.gameCamera.position.z) * 6 * dt;
    this.gameCamera.position.y += (tCamY - this.gameCamera.position.y) * 6 * dt;
    this.gameCamera.lookAt(player.position.x, 1.0, player.position.z);

    this.gameRenderer.render(this.gameScene, this.gameCamera);
    this.refresh();
  }

  private lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
  private easeInOut(t: number): number { return t * t * (3 - 2 * t); }

  private scanBones(root: THREE.Object3D): void {
    const boneKeywords: Record<string, string[]> = {
      leftArm: ['shoulder', 'arm', 'upperarm', 'bicep', 'forearm', 'hand'].map(k => k + 'l'),
      rightArm: ['shoulder', 'arm', 'upperarm', 'bicep', 'forearm', 'hand'].map(k => k + 'r'),
      leftThigh: ['thigh', 'upleg', 'femur', 'leg'].map(k => k + 'l'),
      rightThigh: ['thigh', 'upleg', 'femur', 'leg'].map(k => k + 'r'),
      leftLeg: ['leg', 'calf', 'shin', 'tibia'].map(k => k + 'l'),
      rightLeg: ['leg', 'calf', 'shin', 'tibia'].map(k => k + 'r'),
      leftFoot: ['foot', 'ankle', 'toe'].map(k => k + 'l'),
      rightFoot: ['foot', 'ankle', 'toe'].map(k => k + 'r')
    };
    const scan = (obj: any) => {
      const name = (obj.name || '').toLowerCase();
      for (const [key, patterns] of Object.entries(boneKeywords)) {
        if (this.kongBones[key]) continue;
        if (patterns.some(p => name.includes(p) || name.includes(p.replace(/[lr]/g, 'l')) || name.includes(p.replace(/[lr]/g, 'r')))) {
          if (obj.isBone || obj.type === 'Bone' || obj.isSkinnedMesh) {
            this.kongBones[key] = obj;
          }
        }
      }
      if (obj.children) for (const c of obj.children) scan(c);
    };
    scan(root);
  }

  // ── UTILITAIRES ───────────────────────────────────────────────
  private showBugOverlay(id: string, name: string, priority: string): void {
    this.bugDetailsText = `${id} — ${name} (${priority})`;
    this.bugOverlayActive = true;
    this.gameActive = false;
    clearInterval(this.gameTimerInt);
    this.refresh();
  }

  testBugNow(): void {
    this.router.navigate(['/test'], { queryParams: { bug: this.pendingBugId } });
  }

  private spawnCollectParticles(pos: THREE.Vector3): void {
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 3 }));
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 4;
      m.position.copy(pos);
      m.position.y = 1;
      this.gameScene.add(m);
      this.collectParticles.push({ mesh: m, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 3, vz: Math.sin(a) * sp, life: 0.7 });
    }
  }

  private updateCollectParticles(dt: number): void {
    this.collectParticles = this.collectParticles.filter(p => {
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 8 * dt;
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = p.life / 0.7;
      (p.mesh.material as THREE.MeshStandardMaterial).transparent = true;
      if (p.life <= 0) { this.gameScene.remove(p.mesh); return false; }
      return true;
    });
  }

  private showToast(icon: string, text: string): void {
    this.toastIcon = icon;
    this.toastText = text;
    this.toastActive = true;
    this.refresh();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => { this.toastActive = false; this.refresh(); }, 2500);
  }

  private updateGameHUD(): void {
    this.hp = Math.max(0, this.gameHp);
    this.bugsCollected = this.gameBugMeshes.length;
    this.totalBugs = this.bugsFromApi.filter(b => b.status !== 'FIXED').length;
    this.level = this.gameLevel;
    this.money = this.gameMoney;
  }

  private triggerGameOver(): void {
    this.gameActive = false;
    clearInterval(this.gameTimerInt);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.goScoreText = this.gameBugsCount + ' bugs catchés — Level ' + this.gameLevel;
    this.gameOverActive = true;
    this.refresh();
  }

  private triggerVictory(): void {
    this.gameActive = false;
    clearInterval(this.gameTimerInt);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.winTimeText = 'Time: ' + (90 - this.gameTimer) + 's — Level: ' + this.gameLevel + ' — $' + this.gameMoney;
    this.gameWinActive = true;
    this.refresh();
  }

  private cleanupGame(): void {
    this.gameActive = false;
    clearInterval(this.gameTimerInt);
    if (this.gameAnimId) cancelAnimationFrame(this.gameAnimId);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.gameKeys = {};
    this.mobileKeys = {};
    this.gameOverActive = false;
    this.gameWinActive = false;
    this.bugOverlayActive = false;
  }

  goBackToTesting(): void {
    this.cleanupGame();
    this.router.navigate(['/test']);
  }

  restartGame(): void {
    this.gameOverActive = false;
    this.gameWinActive = false;
    this.refresh();
    if (this.gameAnimId) cancelAnimationFrame(this.gameAnimId);
    this.gameActive = false;
    clearInterval(this.gameTimerInt);
    this.kongModel = null;
    this.kongBones = {};
    if (this.gameScene) {
      while (this.gameScene.children.length) this.gameScene.remove(this.gameScene.children[0]);
    }
    this.gameBugMeshes = [];
    this.collectParticles = [];
    this.gamePlayer = null;
    setTimeout(() => this.initGame(), 100);
  }

  private onResize(): void {
    if (this.gameActive && this.gameRenderer) {
      this.gameCamera.aspect = window.innerWidth / window.innerHeight;
      this.gameCamera.updateProjectionMatrix();
      this.gameRenderer.setSize(window.innerWidth, window.innerHeight);
    }
  }
}