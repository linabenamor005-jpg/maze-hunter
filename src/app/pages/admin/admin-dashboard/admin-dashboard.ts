// admin-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { AdminAuthService } from '../../../core/services/admin-auth';

interface DemoUser {
    id: string;
    name: string;
    email: string;
    age: number;
    level: 'Débutant' | 'Intermédiaire' | 'Expert';
    avgSessionMin: number;
    sitesTested: number;
    lastActive: string;
    weeklyActivity: number[]; // 7 valeurs, Lun -> Dim (minutes)
}

interface ChartBar {
    label: string;
    value: number;
    heightPct: number;
}

@Component({
    selector: 'app-admin-dashboard',
    standalone: false,
    templateUrl: './admin-dashboard.html',
    styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboardComponent implements OnInit {
    // ===== Navigation =====
    currentPage: 'overview' | 'bugs' | 'users' = 'overview';
    userSearch: string = '';

    // ===== Données =====
    bugs: any[] = [];
    sessions: any[] = [];
    demoUsers: DemoUser[] = [];
    loading = true;

    constructor(
        private api: ApiService,
        public adminAuth: AdminAuthService,
        public router: Router
    ) { }

    ngOnInit(): void {
        this.generateDemoUsers();
        this.loadRealData();
    }

    // ===== Navigation =====
    showPage(page: 'overview' | 'bugs' | 'users'): void {
        this.currentPage = page;
    }

    logout(): void {
        this.adminAuth.logout();
    }

    // ===== Filtre utilisateurs =====
    get filteredUsers(): DemoUser[] {
        const q = this.userSearch.trim().toLowerCase();
        if (!q) return this.demoUsers;
        return this.demoUsers.filter(u =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.level.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q)
        );
    }

    // ===== Chargement API =====
    private loadRealData(): void {
        this.loading = true;
        this.api.getBugs().subscribe({
            next: (bugs) => {
                this.bugs = bugs || [];
                this.loading = false;
            },
            error: () => {
                this.bugs = [];
                this.loading = false;
            }
        });
        this.api.getSessions().subscribe({
            next: (sessions: any[]) => {
                this.sessions = sessions || [];
            },
            error: () => {
                this.sessions = [];
            }
        });
    }

    // ===================================================================
    // KPIs (réels + démo)
    // ===================================================================
    get totalBugs(): number { return this.bugs.length; }
    get totalFixed(): number { return this.bugs.filter(b => b.status === 'FIXED').length; }
    get totalOpen(): number { return this.totalBugs - this.totalFixed; }
    get globalFixRate(): number {
        return this.totalBugs > 0 ? Math.round((this.totalFixed / this.totalBugs) * 100) : 0;
    }
    get totalSitesTested(): number {
        const urls = new Set(this.bugs.map(b => b.url).filter(Boolean));
        this.sessions.forEach(s => { if (s.url) urls.add(s.url); });
        return urls.size;
    }
    get totalSessions(): number { return this.sessions.length; }
    get totalUsers(): number { return this.demoUsers.length; }

    // ===================================================================
    // Bugs : agrégations (réelles)
    // ===================================================================
    get bugsByWeek(): ChartBar[] {
        const now = new Date();
        const weeks: ChartBar[] = [];
        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay() - i * 7);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);

            const count = this.bugs.filter(b => {
                if (!b.created_at) return false;
                const d = new Date(b.created_at);
                return d >= weekStart && d < weekEnd;
            }).length;

            weeks.push({
                label: `S${this.getWeekNumber(weekStart)}`,
                value: count,
                heightPct: 0
            });
        }
        return this.normalizeHeights(weeks);
    }

    get bugsByMonth(): ChartBar[] {
        const now = new Date();
        const months: ChartBar[] = [];
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

            const count = this.bugs.filter(b => {
                if (!b.created_at) return false;
                const d = new Date(b.created_at);
                return d >= monthDate && d < monthEnd;
            }).length;

            months.push({
                label: monthNames[monthDate.getMonth()],
                value: count,
                heightPct: 0
            });
        }
        return this.normalizeHeights(months);
    }

    get bugsByCategory(): ChartBar[] {
        const categorize = (name: string): string => {
            if (/sql|xss|csrf|x-frame|content-security|\bhttp\b|https|cookie|clickjacking|auth|login|exposition|fuite/i.test(name)) return 'Sécurité';
            if (/lent|performance|timeout|charge|temps de r[ée]ponse/i.test(name)) return 'Performance';
            if (/affichage|css|style|responsive|viewport|accessibilit/i.test(name)) return 'Interface';
            if (/formulaire|form|champ|validation|navigation|lien|404|erreur|error/i.test(name)) return 'Fonctionnel';
            return 'Autres';
        };
        const buckets: { [key: string]: number } = { 'Sécurité': 0, 'Fonctionnel': 0, 'Performance': 0, 'Interface': 0, 'Autres': 0 };
        this.bugs.forEach(b => { buckets[categorize(b.name)]++; });
        const bars = Object.entries(buckets).map(([label, value]) => ({ label, value, heightPct: 0 }));
        return this.normalizeHeights(bars);
    }

    get bugsByPriority(): ChartBar[] {
        const order = ['CRITIQUE', 'HIGH', 'MEDIUM', 'LOW'];
        const buckets: { [key: string]: number } = { CRITIQUE: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        this.bugs.forEach(b => {
            const p = (b.priority || '').toUpperCase();
            if (buckets[p] !== undefined) buckets[p]++;
        });
        const bars = order.map(label => ({ label, value: buckets[label], heightPct: 0 }));
        return this.normalizeHeights(bars);
    }

    get bugsByStatus(): ChartBar[] {
        const bars = [
            { label: 'Ouverts', value: this.totalOpen, heightPct: 0 },
            { label: 'Corrigés', value: this.totalFixed, heightPct: 0 }
        ];
        return this.normalizeHeights(bars);
    }

    get recentBugs(): any[] {
        return [...this.bugs]
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
            .slice(0, 15);
    }

    // ===================================================================
    // Utilisateurs : agrégations (démo)
    // ===================================================================
    get usersAgeDistribution(): ChartBar[] {
        const buckets: { [key: string]: number } = { '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };
        this.demoUsers.forEach(u => {
            if (u.age <= 24) buckets['18-24']++;
            else if (u.age <= 34) buckets['25-34']++;
            else if (u.age <= 44) buckets['35-44']++;
            else buckets['45+']++;
        });
        const bars = Object.entries(buckets).map(([label, value]) => ({ label, value, heightPct: 0 }));
        return this.normalizeHeights(bars);
    }

    get usersLevelDistribution(): ChartBar[] {
        const buckets: { [key: string]: number } = { 'Débutant': 0, 'Intermédiaire': 0, 'Expert': 0 };
        this.demoUsers.forEach(u => { buckets[u.level]++; });
        const bars = Object.entries(buckets).map(([label, value]) => ({ label, value, heightPct: 0 }));
        return this.normalizeHeights(bars);
    }

    get avgSessionTimeAllUsers(): number {
        if (this.demoUsers.length === 0) return 0;
        const total = this.demoUsers.reduce((sum, u) => sum + u.avgSessionMin, 0);
        return Math.round(total / this.demoUsers.length);
    }

    get avgSitesTestedPerUser(): number {
        if (this.demoUsers.length === 0) return 0;
        const total = this.demoUsers.reduce((sum, u) => sum + u.sitesTested, 0);
        return Math.round((total / this.demoUsers.length) * 10) / 10;
    }

    // ===== Courbe d'usage hebdo (démo) =====
    get weeklyUsagePoints(): string {
        const days = 7;
        const totals = new Array(days).fill(0);
        this.demoUsers.forEach(u => {
            u.weeklyActivity.forEach((v, i) => { totals[i] += v; });
        });
        const max = Math.max(...totals, 1);
        const width = 560;
        const height = 140;
        const step = width / (days - 1);
        return totals
            .map((v, i) => {
                const x = Math.round(i * step);
                const y = Math.round(height - (v / max) * (height - 20) - 10);
                return `${x},${y}`;
            })
            .join(' ');
    }

    get weeklyUsageDayLabels(): string[] {
        return ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    }

    // ===================================================================
    // Helpers
    // ===================================================================
    private normalizeHeights(bars: ChartBar[]): ChartBar[] {
        const max = Math.max(...bars.map(b => b.value), 1);
        return bars.map(b => ({ ...b, heightPct: Math.round((b.value / max) * 100) }));
    }

    private getWeekNumber(d: Date): number {
        const date = new Date(d.getTime());
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    }

    private generateDemoUsers(): void {
        const firstNames = ['Yassine', 'Amira', 'Karim', 'Sarra', 'Mohamed', 'Ines', 'Ahmed', 'Nour', 'Sami', 'Rania', 'Wassim', 'Emna'];
        const levels: DemoUser['level'][] = ['Débutant', 'Intermédiaire', 'Expert'];
        this.demoUsers = firstNames.map((name, i) => {
            const age = 19 + Math.floor(Math.random() * 30);
            const level = levels[Math.floor(Math.random() * levels.length)];
            const weeklyActivity = Array.from({ length: 7 }, () => Math.floor(Math.random() * 90) + 10);
            const daysAgo = Math.floor(Math.random() * 6);
            const lastActive = new Date();
            lastActive.setDate(lastActive.getDate() - daysAgo);
            return {
                id: `USR-${(i + 1).toString().padStart(3, '0')}`,
                name,
                email: `${name.toLowerCase()}@maze-hunter.tn`,
                age,
                level,
                avgSessionMin: Math.floor(Math.random() * 40) + 15,
                sitesTested: Math.floor(Math.random() * 12) + 1,
                lastActive: daysAgo === 0 ? "Aujourd'hui" : `Il y a ${daysAgo} jour(s)`,
                weeklyActivity
            };
        });
    }
}