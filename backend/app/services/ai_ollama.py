import ollama
import json
import re

client = ollama.Client(host='http://host.docker.internal:11434')

def clean_json_response(content: str) -> str:
    """Nettoie la réponse brute pour obtenir un JSON valide."""
    content = re.sub(r'^```json\s*', '', content)
    content = re.sub(r'\s*```$', '', content)
    content = re.sub(r',\s*}', '}', content)
    content = re.sub(r',\s*]', ']', content)
    content = content.strip()
    return content

def generate_test_cases_from_feature(feature_description: str, test_types: list) -> list:
    prompt = f"""
    Tu es un expert en tests logiciels.

    À partir de la description suivante d'une fonctionnalité web :
    "{feature_description}"

    Génère EXACTEMENT 6 cas de test incluant les types suivants : {', '.join(test_types)}.

    La répartition doit être :
    - 2 cas Happy Path
    - 2 cas Negative (cas d'erreur)
    - 1 cas Edge Case (cas limite)
    - 1 cas Security (injection SQL ou XSS)

    Formate ta réponse en JSON strict avec cette structure, sans texte additionnel :
    {{
        "test_cases": [
            {{
                "id": "TC-AI-001",
                "title": "Titre clair",
                "description": "Étapes détaillées",
                "type": "nominal" | "critique" | "saisir"
            }}
        ]
    }}
    ATTENTION : Réponds uniquement avec le JSON, sans aucune virgule en trop, sans commentaire.
    """
    try:
        response = client.chat(
            model="phi3:mini",
            messages=[
                {"role": "system", "content": "Tu es un expert QA. Réponds uniquement en JSON valide, sans virgules finales."},
                {"role": "user", "content": prompt}
            ],
            options={
                "temperature": 0.2,
                "num_predict": 2048
            }
        )
        raw = response['message']['content']
        cleaned = clean_json_response(raw)
        result = json.loads(cleaned)
        return result.get("test_cases", [])
    except json.JSONDecodeError as e:
        print(f"❌ Erreur JSON : {e}")
        print("🔍 Réponse brute :", raw)
        match = re.search(r'"test_cases"\s*:\s*(\[.*?\])', raw, re.DOTALL)
        if match:
            try:
                array_str = match.group(1)
                array_str = clean_json_response(array_str)
                test_cases = json.loads(array_str)
                return test_cases
            except:
                pass
        return []
    except Exception as e:
        print(f"❌ Erreur IA : {e}")
        return []

# Fonction dummy pour éviter l'erreur d'import (si la route existe encore)
def generate_test_cases_from_bug(bug_name: str, bug_description: str, bug_priority: str) -> list:
    return []