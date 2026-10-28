import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from app.database import get_db_connection
import uuid
import re
from urllib.parse import urlparse, urljoin

def detect_bugs_static(url: str) -> list:
    bugs = []
    try:
        response = requests.get(url, timeout=15, allow_redirects=True)
        html = response.text
        soup = BeautifulSoup(html, 'html.parser')

        # --- 1. En-têtes de sécurité ---
        headers = response.headers
        # X-Frame-Options
        if 'X-Frame-Options' not in headers:
            bugs.append({
                'name': 'Absence de X-Frame-Options',
                'description': 'Le site est vulnérable au clickjacking.',
                'priority': 'MEDIUM'
            })
        # Content-Security-Policy
        if 'Content-Security-Policy' not in headers and 'X-Content-Security-Policy' not in headers:
            bugs.append({
                'name': 'Absence de Content-Security-Policy (CSP)',
                'description': 'Aucune politique de sécurité du contenu définie, ce qui augmente les risques de XSS et d\'injection.',
                'priority': 'HIGH'
            })
        # X-Content-Type-Options
        if headers.get('X-Content-Type-Options', '').lower() != 'nosniff':
            bugs.append({
                'name': 'Absence de X-Content-Type-Options: nosniff',
                'description': 'Le navigateur pourrait interpréter les fichiers avec un mime-type incorrect, favorisant les attaques MIME.',
                'priority': 'MEDIUM'
            })
        # Strict-Transport-Security (HSTS)
        if 'Strict-Transport-Security' not in headers:
            bugs.append({
                'name': 'Absence de HSTS (Strict-Transport-Security)',
                'description': 'Le site n\'impose pas de connexion HTTPS, ce qui peut exposer les utilisateurs à des attaques de type downgrade.',
                'priority': 'HIGH'
            })
        # Referrer-Policy
        if 'Referrer-Policy' not in headers:
            bugs.append({
                'name': 'Absence de Referrer-Policy',
                'description': 'Le site ne contrôle pas les informations de référent, ce qui peut exposer des données sensibles.',
                'priority': 'LOW'
            })
        # Permissions-Policy
        if 'Permissions-Policy' not in headers:
            bugs.append({
                'name': 'Absence de Permissions-Policy',
                'description': 'Le site n\'impose pas de restrictions sur les fonctionnalités du navigateur (géolocalisation, caméra, etc.).',
                'priority': 'LOW'
            })

        # --- 2. Protocole HTTPS / contenu mixte ---
        parsed = urlparse(url)
        if parsed.scheme == 'http':
            bugs.append({
                'name': 'Site accessible en HTTP (non chiffré)',
                'description': 'La connexion n\'est pas sécurisée. Les données peuvent être interceptées.',
                'priority': 'HIGH'
            })
        # Vérifier le contenu mixte (scripts, images, iframes en HTTP)
        mixed_http = []
        for tag in soup.find_all(['script', 'link', 'img', 'iframe'], src=True):
            src = tag.get('src', '')
            if src.startswith('http://') and not src.startswith('https://') and not src.startswith('//'):
                mixed_http.append(src)
        if mixed_http:
            bugs.append({
                'name': 'Contenu mixte (ressources chargées en HTTP)',
                'description': f"{len(mixed_http)} ressources sont chargées en HTTP sur une page HTTPS, ce qui réduit la sécurité.",
                'priority': 'HIGH'
            })

        # --- 3. Cookies ---
        if 'Set-Cookie' in headers:
            cookies = headers.get('Set-Cookie', '')
            if not re.search(r';\s*Secure', cookies, re.I):
                bugs.append({
                    'name': 'Cookie sans attribut Secure',
                    'description': 'Les cookies ne sont pas marqués Secure, ils peuvent être transmis en clair.',
                    'priority': 'HIGH'
                })
            if not re.search(r';\s*HttpOnly', cookies, re.I):
                bugs.append({
                    'name': 'Cookie sans attribut HttpOnly',
                    'description': 'Les cookies sont accessibles via JavaScript, ce qui facilite le vol de session (XSS).',
                    'priority': 'HIGH'
                })
            if not re.search(r';\s*SameSite', cookies, re.I):
                bugs.append({
                    'name': 'Cookie sans attribut SameSite',
                    'description': 'Les cookies peuvent être envoyés lors de requêtes cross-site, augmentant les risques de CSRF.',
                    'priority': 'MEDIUM'
                })

        # --- 4. Formulaires ---
        forms = soup.find_all('form')
        for form in forms:
            # Méthode GET non sécurisée
            if form.get('method', '').upper() == 'GET':
                bugs.append({
                    'name': 'Formulaire avec méthode GET',
                    'description': f"Le formulaire {form.get('action', '')} utilise la méthode GET, exposant les données dans l'URL.",
                    'priority': 'LOW'
                })
                # On arrête après un formulaire pour éviter les doublons
                break
            # Absence de champ CSRF
            if not form.find('input', {'name': '_csrf'}) and not form.find('input', {'name': 'csrf_token'}):
                bugs.append({
                    'name': 'Formulaire sans protection CSRF',
                    'description': f"Le formulaire {form.get('action', '')} ne contient pas de champ CSRF.",
                    'priority': 'HIGH'
                })
                break

        # --- 5. Accessibilité et bonnes pratiques ---
        # Images sans attribut alt
        images_without_alt = soup.find_all('img', alt=False)
        if images_without_alt:
            bugs.append({
                'name': 'Images sans attribut alt (accessibilité)',
                'description': f"{len(images_without_alt)} images n'ont pas d'attribut alt, ce qui nuit à l'accessibilité.",
                'priority': 'LOW'
            })
        # Balise meta viewport manquante
        if not soup.find('meta', attrs={'name': 'viewport'}):
            bugs.append({
                'name': 'Balise meta viewport manquante',
                'description': 'Le site n\'est pas optimisé pour les appareils mobiles.',
                'priority': 'LOW'
            })
        # Balise title manquante
        if not soup.find('title'):
            bugs.append({
                'name': 'Balise title manquante',
                'description': 'Le site n\'a pas de titre, ce qui nuit au référencement et à l\'accessibilité.',
                'priority': 'LOW'
            })

        # --- 6. Performance ---
        if response.elapsed.total_seconds() > 3:
            bugs.append({
                'name': 'Temps de réponse serveur élevé',
                'description': f"Le serveur a mis {response.elapsed.total_seconds():.2f}s à répondre, ce qui est lent.",
                'priority': 'LOW'
            })

        # --- 7. Liens cassés (vérification simple sur quelques liens) ---
        # On limite pour éviter de trop charger
        links = soup.find_all('a', href=True)[:10]  # Limite à 10 liens pour vitesse
        broken_links = []
        for link in links:
            href = link.get('href')
            if href.startswith('#') or href.startswith('javascript:') or href.startswith('mailto:'):
                continue
            full_url = urljoin(url, href)
            try:
                resp = requests.head(full_url, timeout=5, allow_redirects=True)
                if resp.status_code == 404:
                    broken_links.append(full_url)
            except:
                pass
        if broken_links:
            bugs.append({
                'name': 'Liens cassés (404)',
                'description': f"{len(broken_links)} liens renvoient une erreur 404.",
                'priority': 'MEDIUM'
            })

        # --- 8. Messages d'erreur SQL exposés (recherche simple) ---
        sql_errors = ['sql', 'mysql', 'oracle', 'postgresql', 'odbc', 'jdbc', 'sqlstate', 'sqlsrv']
        if any(err in html.lower() for err in sql_errors):
            bugs.append({
                'name': 'Message d\'erreur SQL exposé',
                'description': 'La page peut révéler des informations de base de données en cas d\'erreur.',
                'priority': 'CRITIQUE'
            })

        # --- 9. Paramètres GET injectables (détection de paramètres dans l'URL) ---
        if '?' in url and '=' in url:
            bugs.append({
                'name': 'Paramètres GET dans l\'URL (potentielle injection)',
                'description': f"L'URL contient des paramètres GET, ce qui peut être exploitable pour des injections.",
                'priority': 'MEDIUM'
            })

        # --- 10. Scripts externes ---
        scripts = soup.find_all('script', src=True)
        for script in scripts:
            src = script.get('src')
            if src and src.startswith('http://') and not src.startswith('https://'):
                bugs.append({
                    'name': 'Script chargé en HTTP non sécurisé',
                    'description': f"Le script {src} est chargé en HTTP, risquant une interception.",
                    'priority': 'HIGH'
                })
                break

    except Exception as e:
        print(f"Erreur scan statique : {e}")
    return bugs

async def detect_bugs_dynamic(url: str) -> list:
    bugs = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url)
            # Vérification de l'utilisation de eval ou document.write
            eval_count = await page.evaluate("""
                () => {
                    const scripts = document.querySelectorAll('script');
                    let count = 0;
                    scripts.forEach(s => {
                        if (s.textContent.includes('eval(') || s.textContent.includes('document.write(')) {
                            count++;
                        }
                    });
                    return count;
                }
            """)
            if eval_count > 0:
                bugs.append({
                    'name': 'Utilisation de eval() ou document.write()',
                    'description': f"{eval_count} script(s) utilisent eval() ou document.write(), risquant une XSS.",
                    'priority': 'CRITIQUE'
                })
            await browser.close()
    except Exception as e:
        print(f"Erreur scan dynamique : {e}")
    return bugs

def save_bugs_to_db(url: str, bugs: list, session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    for bug in bugs:
        bug_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"
        cursor.execute("""
            INSERT INTO bugs (id, url, name, description, priority, status, test_session_id)
            VALUES (:id, :url, :name, :description, :priority, 'OPEN', :session_id)
        """, id=bug_id, url=url, name=bug['name'], description=bug['description'],
           priority=bug['priority'], session_id=session_id)
    conn.commit()
    cursor.close()
    conn.close()

async def run_scan(url: str, session_id: str):
    try:
        print(f"🔍 [run_scan] Début pour {url}")
        bugs = []
        
        print("📄 Scan statique...")
        static_bugs = detect_bugs_static(url)
        print(f"   → {len(static_bugs)} bugs statiques")
        bugs.extend(static_bugs)
        
        print("🎭 Scan dynamique...")
        dynamic_bugs = await detect_bugs_dynamic(url)
        print(f"   → {len(dynamic_bugs)} bugs dynamiques")
        bugs.extend(dynamic_bugs)
        
        # Éliminer les doublons (par nom)
        unique_bugs = {bug['name']: bug for bug in bugs}.values()
        print(f"🧹 {len(unique_bugs)} bugs uniques")
        
        if unique_bugs:
            print("💾 Sauvegarde en base...")
            save_bugs_to_db(url, list(unique_bugs), session_id)
            print("✅ Sauvegarde OK")
        else:
            print("⚠️ Aucun bug détecté")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE test_sessions SET status = 'COMPLETED', finished_at = SYSTIMESTAMP WHERE id = :id", id=session_id)
        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Scan terminé")
    except Exception as e:
        print(f"❌ ERREUR dans run_scan : {e}")
        import traceback
        traceback.print_exc()
        raise