import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-test',
  standalone: false,
  templateUrl: './test.html',
  styleUrls: ['./test.scss']
})
export class TestComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('kongCanvas', { static: true }) kongCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Variables exposées au template
  bugs: any[] = [];
  openBugs: any[] = [];
  sessions: any[] = [];
  targetUrl: string = '';
  currentBugId: string | null = null;
  generatedTestCases: any[] = [];

  // Catégories de "Requirements" dérivées automatiquement des bugs détectés
  // Les regex ont été élargies pour matcher les nouveaux noms de bugs générés par le scanner enrichi.
  requirementCategories = [
    { key: 'availability', label: 'Disponibilité', match: /inaccessible|down|timeout|connexion/i },
    { key: 'security-sql', label: 'Sécurité — Injection SQL', match: /sql\s*injection|injection sql|message d'erreur sql/i },
    { key: 'security-xss', label: 'Sécurité — XSS', match: /xss|cross[-\s]?site|eval|document\.write/i },
    { key: 'security-csrf', label: 'Sécurité — CSRF', match: /csrf|cross-site request forgery|formulaire sans protection csrf/i },
    { key: 'security-headers', label: 'Sécurité — En-têtes HTTP', match: /x-frame-options|content-security-policy|\bcsp\b|hsts|strict-transport|referrer-policy|permissions-policy|x-content-type|en-t[êe]te/i },
    { key: 'security-cookies', label: 'Sécurité — Cookies', match: /cookie|secure|httponly|samesite/i },
    { key: 'security-https', label: 'Sécurité — HTTPS / chiffrement', match: /https|ssl|tls|certificat|certificate|mixed content|http non sécurisé|non chiffré|site accessible en http/i },
    { key: 'functional-form', label: 'Fonctionnel — Formulaires', match: /formulaire|form|champ|validation|csrf/i },
    { key: 'functional-nav', label: 'Fonctionnel — Navigation', match: /navigation|lien\b|link|404|redirection|broken link|paramètre/i },
    { key: 'ui-accessibility', label: 'UI — Accessibilité', match: /alt|accessibilité|viewport|title|meta viewport/i },
    { key: 'ui-responsive', label: 'UI — Responsive', match: /responsive|mobile|tablette|écran|viewport/i },
    { key: 'performance', label: 'Performance', match: /lent|performance|timeout|charge|slow|temps de réponse/i },
    { key: 'other', label: 'Autres anomalies', match: /.*/ }
  ];

  // Outils spécialisés — liens externes groupés par catégorie
  specializedTools = [
    {
      category: 'Tests de performance / charge',
      items: [
        { name: 'Apache JMeter', url: 'https://jmeter.apache.org/', desc: 'Tests de charge et de performance' },
        { name: 'k6', url: 'https://k6.io/', desc: 'Load testing moderne, scriptable en JS' },
        { name: 'Gatling', url: 'https://gatling.io/', desc: 'Tests de charge haute performance' },
        { name: 'Locust', url: 'https://locust.io/', desc: 'Load testing en Python' },
        { name: 'Apache Bench (ab)', url: 'https://httpd.apache.org/docs/2.4/programs/ab.html', desc: 'Benchmark HTTP simple en ligne de commande' }
      ]
    },
    {
      category: 'Sécurité',
      items: [
        { name: 'OWASP ZAP', url: 'https://www.zaproxy.org/', desc: 'Scanner de vulnérabilités web' },
        { name: 'Burp Suite', url: 'https://portswigger.net/burp', desc: 'Proxy et tests de pénétration web' },
        { name: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/', desc: 'Référentiel des risques de sécurité web' },
        { name: 'Nikto', url: 'https://github.com/sullo/nikto', desc: 'Scanner de vulnérabilités serveur web' },
        { name: 'sqlmap', url: 'https://sqlmap.org/', desc: 'Détection et exploitation d\'injections SQL' }
      ]
    },
    {
      category: 'API / Backend',
      items: [
        { name: 'Postman', url: 'https://www.postman.com/', desc: 'Tests et documentation d\'API REST' },
        { name: 'Insomnia', url: 'https://insomnia.rest/', desc: 'Client API léger' },
        { name: 'SoapUI', url: 'https://www.soapui.org/', desc: 'Tests d\'API SOAP et REST' },
        { name: 'Swagger / OpenAPI', url: 'https://swagger.io/', desc: 'Documentation et validation d\'API' },
        { name: 'HTTPie', url: 'https://httpie.io/', desc: 'Client HTTP en ligne de commande' }
      ]
    },
    {
      category: 'Tests fonctionnels / E2E',
      items: [
        { name: 'Playwright', url: 'https://playwright.dev/', desc: 'Automatisation de tests web (utilisé par ce scanner)' },
        { name: 'Selenium', url: 'https://www.selenium.dev/', desc: 'Automatisation de navigateur, standard historique' },
        { name: 'Cypress', url: 'https://www.cypress.io/', desc: 'Tests E2E modernes pour applications web' },
        { name: 'TestCafe', url: 'https://testcafe.io/', desc: 'Tests E2E sans WebDriver' }
      ]
    },
    {
      category: 'Accessibilité & Qualité',
      items: [
        { name: 'Lighthouse', url: 'https://developer.chrome.com/docs/lighthouse/', desc: 'Audit performance, SEO, accessibilité' },
        { name: 'axe DevTools', url: 'https://www.deque.com/axe/devtools/', desc: 'Tests d\'accessibilité automatisés' },
        { name: 'WAVE', url: 'https://wave.webaim.org/', desc: 'Évaluation d\'accessibilité web' },
        { name: 'W3C Validator', url: 'https://validator.w3.org/', desc: 'Validation HTML/CSS' }
      ]
    },
    {
      category: 'Monitoring & Observabilité',
      items: [
        { name: 'Grafana', url: 'https://grafana.com/', desc: 'Tableaux de bord de monitoring' },
        { name: 'Sentry', url: 'https://sentry.io/', desc: 'Suivi d\'erreurs en production' },
        { name: 'Uptime Robot', url: 'https://uptimerobot.com/', desc: 'Surveillance de disponibilité' }
      ]
    }
  ];

  // Gestion de la modale
  bugModalActive = false;
  modalBugId = '';

  // Three.js
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private kongModel: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clock = new THREE.Clock();
  private animationId: number | null = null;
  private rotationAngle = 0;
  private toastTimeout: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Gérer le paramètre ?bug=
    this.route.queryParams.subscribe(params => {
      const bugId = params['bug'];
      if (bugId) {
        setTimeout(() => {
          this.showPage('bugs');
          this.loadBugs();
          setTimeout(() => {
            const row = document.getElementById(`bug-row-${bugId}`);
            if (row) {
              row.classList.add('bug-highlight');
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }, 300);
      }
    });
    this.loadBugs();
    this.loadSessions();
  }

  ngAfterViewInit(): void {
    this.initKongIcon();
    this.bindGlobalFunctions();
    const savedUrl = localStorage.getItem('targetUrl') || 'http://localhost:3000';
    this.targetUrl = savedUrl;
    const input = document.getElementById('target-url') as HTMLInputElement;
    if (input) input.value = savedUrl;
    this.updateKPIs();
    this.initBugSearch();
    this.showPage('dashboard');
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) this.renderer.dispose();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  // ===== API =====
  loadBugs(): void {
    this.api.getBugs().subscribe({
      next: (data) => {
        this.bugs = data;
        this.openBugs = data.filter((b: any) => b.status === 'OPEN');
        this.updateKPIs();
        this.cdr.detectChanges();
        console.log('✅ Bugs chargés :', this.bugs);
      },
      error: (err) => console.error('❌ Erreur chargement bugs :', err)
    });
  }

  loadSessions(): void {
    this.api.getSessions().subscribe({
      next: (data: any[]) => {
        this.sessions = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('❌ Erreur chargement sessions :', err)
    });
  }

  bugsForSession(sessionId: string): any[] {
    return this.bugs.filter(b => b.test_session_id === sessionId);
  }

  // Regroupe automatiquement les bugs par catégorie de "requirement".
  // Un bug n'appartient qu'à UNE seule catégorie (la première qui correspond).
  getRequirementsCoverage(): any[] {
    const nonOther = this.requirementCategories.filter(c => c.key !== 'other');
    const classify = (bugName: string): string => {
      const found = nonOther.find(c => c.match.test(bugName));
      return found ? found.key : 'other';
    };

    return this.requirementCategories.map(cat => {
      const bugsInCategory = this.bugs.filter(b => classify(b.name) === cat.key);
      const total = bugsInCategory.length;
      const fixed = bugsInCategory.filter(b => b.status === 'FIXED').length;
      const coverage = total > 0 ? Math.round((fixed / total) * 100) : 0;
      return { ...cat, total, fixed, open: total - fixed, coverage, bugs: bugsInCategory };
    }).filter(c => c.total > 0);
  }

  startScan(): void {
    if (!this.targetUrl) {
      alert('Veuillez entrer une URL.');
      return;
    }
    this.showToast('🔍 Scan en cours... (analyse statique + dynamique)');
    this.api.scanUrl(this.targetUrl).subscribe({
      next: (res) => {
        console.log('✅ Scan lancé, session :', res.session_id);
        this.pollScanSession(res.session_id);
      },
      error: (err) => {
        console.error('❌ Erreur scan :', err);
        this.showToast('❌ Impossible de lancer le scan (backend indisponible ?)');
      }
    });
  }

  private pollScanSession(sessionId: string, attempt: number = 0): void {
    const maxAttempts = 30;
    this.api.getSessions().subscribe({
      next: (sessions: any[]) => {
        const session = sessions.find((s: any) => s.id === sessionId);
        if (session && session.status === 'COMPLETED') {
          this.loadBugs();
          this.loadSessions();
          this.showToast('✅ Scan terminé ! Bugs détectés mis à jour.');
          this.showPage('bugs');
          return;
        }
        if (attempt >= maxAttempts) {
          this.loadBugs();
          this.showToast('⏱️ Le scan prend plus de temps que prévu, liste rafraîchie quand même.');
          return;
        }
        setTimeout(() => this.pollScanSession(sessionId, attempt + 1), 2000);
      },
      error: (err) => {
        console.error('❌ Erreur lors du suivi du scan :', err);
        this.loadBugs();
      }
    });
  }

  fixBug(bugId: string): void {
    this.api.fixBug(bugId).subscribe({
      next: () => {
        this.showToast('✅ Bug corrigé !');
        this.loadBugs();
      },
      error: (err) => console.error('❌ Erreur correction :', err)
    });
  }

  // ===== MODAL BUG =====
  openBugTest(bugId: string): void {
    this.currentBugId = bugId;
    this.modalBugId = bugId;
    this.bugModalActive = true;
    document.querySelectorAll('.qa-table tbody tr').forEach(row => row.classList.remove('bug-highlight'));
    const row = document.getElementById(`bug-row-${bugId}`);
    if (row) row.classList.add('bug-highlight');
    this.cdr.detectChanges();
  }

  closeBugModal(): void {
    this.bugModalActive = false;
    this.currentBugId = null;
    document.querySelectorAll('.qa-table tbody tr').forEach(row => row.classList.remove('bug-highlight'));
    this.cdr.detectChanges();
  }

  validateBugTest(result: 'pass' | 'fail'): void {
    if (!this.currentBugId) {
      this.showToast('❌ Aucun bug sélectionné.');
      return;
    }
    const apiResult = result === 'pass' ? 'PASS' : 'FAIL';
    const testedBugId = this.currentBugId;
    this.api.testBug(testedBugId, apiResult).subscribe({
      next: () => {
        if (result === 'pass') {
          this.showToast(`✅ Test réussi ! Bug corrigé.`);
          this.bugs = this.bugs.filter(b => b.id !== testedBugId);
          this.openBugs = this.openBugs.filter(b => b.id !== testedBugId);
          this.updateKPIs();
          this.closeBugModal();
          setTimeout(() => {
            this.router.navigate(['/game']);
          }, 1500);
        } else {
          this.showToast(`❌ Test échoué. Redirection vers les cas de test.`);
          this.closeBugModal();
          if (typeof this.showPage === 'function') {
            this.showPage('testcases');
          } else {
            this.router.navigate(['/testcases']);
          }
        }
      },
      error: (err) => console.error('❌ Erreur test :', err)
    });
  }

  // ===== NAVIGATION =====
  private pages = ['dashboard', 'generator', 'testcases', 'bugs', 'pvt', 'reports', 'requirements', 'testruns', 'tools'];
  private titles: any = {
    dashboard: 'Dashboard',
    generator: 'AI Generator',
    testcases: 'Test Cases',
    bugs: 'Bug Tracker',
    pvt: 'Rapport PVT',
    reports: 'Rapport Global',
    requirements: 'Exigences',
    testruns: 'Test Runs',
    tools: 'Outils Spécialisés'
  };

  showPage(id: string): void {
    this.pages.forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const pageEl = document.getElementById(`page-${id}`);
    if (pageEl) pageEl.classList.add('active');
    const breadcrumb = document.getElementById('breadcrumb-cur');
    if (breadcrumb) breadcrumb.innerText = this.titles[id] || id;
    document.querySelectorAll('.nav-item').forEach(n => {
      if (n.getAttribute('onclick')?.includes(`'${id}'`)) n.classList.add('active');
    });
  }

  toggleTag(el: EventTarget | null): void {
    (el as HTMLElement)?.classList.toggle('active');
  }

  generateCases(): void {
  // Utiliser le bon ID : "feat-desc" (id défini dans test.html)
  const descriptionInput = document.getElementById('feat-desc') as HTMLTextAreaElement;
  const description = descriptionInput ? descriptionInput.value : '';

  if (!description.trim()) {
    this.showToast('⚠️ Veuillez décrire une fonctionnalité.');
    return;
  }

  // Récupérer les tags actifs (sélectionnés par l'utilisateur)
  const tags = document.querySelectorAll('.tag.active');
  const testTypes = Array.from(tags).map(t => t.textContent?.trim() || '');
  if (testTypes.length === 0) {
    this.showToast('⚠️ Sélectionnez au moins un type de test.');
    return;
  }

  this.showToast('🧠 Kong Intelligence analyse...');
  this.api.generateTestsFromFeature(description, testTypes).subscribe({
    next: (response) => {
      this.generatedTestCases = response.test_cases || [];
      this.cdr.detectChanges();
      this.showToast(`✅ ${this.generatedTestCases.length} cas de test générés !`);
      // Afficher la section des résultats
      const container = document.getElementById('generated-cases');
      if (container) container.style.display = 'block';
    },
    error: (err) => {
      console.error('❌ Erreur IA :', err);
      this.showToast('❌ Erreur lors de la génération. Vérifiez que Ollama tourne.');
    }
  });
}
  // ===== URL TARGET =====
  saveTargetUrl(): void {
    const input = document.getElementById('target-url') as HTMLInputElement;
    if (!input) return;
    const url = input.value.trim();
    if (url) {
      this.targetUrl = url;
      localStorage.setItem('targetUrl', url);
      this.showToast('🎯 Cible enregistrée : ' + url);
    }
  }

  goToGame(): void {
    const input = document.getElementById('target-url') as HTMLInputElement;
    if (input) {
      const url = input.value.trim();
      if (url) {
        this.targetUrl = url;
        localStorage.setItem('targetUrl', url);
      }
    }
    this.router.navigate(['/game']);
  }

  // ===== TOAST =====
  private showToast(message: string): void {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.92); color: #e9e2dc;
      padding: 14px 30px; border-radius: 12px;
      font-size: 14px; z-index: 2000;
      border: 1px solid #262321;
      backdrop-filter: blur(8px);
      animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  // ===== SEARCH =====
  private initBugSearch(): void {
    const searchInput = document.getElementById('bug-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const rows = document.querySelectorAll('#bugs-table-body tr');
        rows.forEach(row => {
          const text = row.textContent?.toLowerCase() || '';
          (row as HTMLElement).style.display = text.includes(query) ? '' : 'none';
        });
      });
    }
  }

  // ===== KPIs =====
  private updateKPIs(): void {
    const fixed = this.bugs.filter(b => b.status === 'FIXED').length;
    const kpiPassed = document.getElementById('kpi-passed');
    if (kpiPassed) {
      kpiPassed.textContent = fixed.toString();
    }
    const open = this.openBugs.length;
    const kpiBugs = document.getElementById('kpi-bugs');
    if (kpiBugs) {
      kpiBugs.textContent = open.toString();
    }
  }

  // ===== KING KONG 3D ICON =====
  private initKongIcon(): void {
    const canvas = this.kongCanvasRef.nativeElement;
    const container = canvas.parentElement!;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    // Lumières
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0xffaa88, 2.0);
    mainLight.position.set(2, 3, 4);
    this.scene.add(mainLight);
    const fillLight = new THREE.PointLight(0xff8844, 1.0);
    fillLight.position.set(1, 2, 2);
    this.scene.add(fillLight);
    const backLight = new THREE.PointLight(0xff6633, 0.9);
    backLight.position.set(-1, 1.5, -2);
    this.scene.add(backLight);
    const frontLight = new THREE.PointLight(0xffaa66, 0.8);
    frontLight.position.set(0, 1, 3);
    this.scene.add(frontLight);

    this.camera.position.set(0, 1.0, 2.8);
    this.camera.lookAt(0, 0.8, 0);

    const loader = new GLTFLoader();
    loader.load(
      'assets/models/king_kong_2005/scene.gltf',
      (gltf) => {
        this.kongModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(this.kongModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.9 / maxDim;
        this.kongModel.scale.setScalar(scale);
        box.setFromObject(this.kongModel);
        const center = new THREE.Vector3();
        box.getCenter(center);
        this.kongModel.position.sub(center);
        this.kongModel.position.y -= 0.1;
        this.kongModel.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.name && child.name.toLowerCase().includes('eye') && child.material) {
              child.material.emissive = new THREE.Color(0xff6600);
              child.material.emissiveIntensity = 0.7;
            }
          }
        });
        this.scene.add(this.kongModel);
        const glowLight = new THREE.PointLight(0xff8844, 1.5, 6);
        glowLight.position.set(0, 0.7, 0.5);
        this.kongModel.add(glowLight);
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.kongModel);
          this.mixer.clipAction(gltf.animations[0]).play();
        }
      },
      undefined,
      () => {
        this.createFallbackKong();
      }
    );

    this.animateKong();
  }

  private createFallbackKong(): void {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 1.2, 24), bodyMat);
    body.position.y = 0;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), bodyMat);
    head.position.y = 0.85;
    group.add(head);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff4422, emissiveIntensity: 0.8 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), eyeMat);
    leftEye.position.set(-0.22, 1.08, 0.72);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), eyeMat);
    rightEye.position.set(0.22, 1.08, 0.72);
    group.add(leftEye);
    group.add(rightEye);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.1, 12), armMat);
    leftArm.position.set(-0.75, 0.45, 0);
    leftArm.rotation.z = 0.3;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.1, 12), armMat);
    rightArm.position.set(0.75, 0.45, 0);
    rightArm.rotation.z = -0.3;
    group.add(rightArm);
    group.scale.setScalar(1.1);
    this.scene.add(group);
    this.kongModel = group;
    const glowLight = new THREE.PointLight(0xff8844, 1.5, 6);
    glowLight.position.set(0, 0.6, 0.5);
    group.add(glowLight);
  }

  private animateKong(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      this.rotationAngle += delta * 1.5;
      if (this.mixer) this.mixer.update(delta);
      if (this.kongModel) {
        this.kongModel.rotation.y = this.rotationAngle;
        const glowLight = this.kongModel.children.find(c => c instanceof THREE.PointLight);
        if (glowLight) {
          (glowLight as THREE.PointLight).intensity = 1.3 + Math.sin(Date.now() * 0.008) * 0.5;
        }
      }
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  private bindGlobalFunctions(): void {
    (window as any).showPage = this.showPage.bind(this);
    (window as any).toggleTag = this.toggleTag.bind(this);
    (window as any).generateCases = this.generateCases.bind(this);
    (window as any).openBugTest = this.openBugTest.bind(this);
    (window as any).closeBugModal = this.closeBugModal.bind(this);
    (window as any).validateBugTest = this.validateBugTest.bind(this);
    (window as any).saveTargetUrl = this.saveTargetUrl.bind(this);
    (window as any).goToGame = this.goToGame.bind(this);
  }
}