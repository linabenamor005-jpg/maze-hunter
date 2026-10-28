from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.models import BugResponse, FixRequest, TestRequest
from app.database import get_db_connection
import oracledb

router = APIRouter()

@router.get("/bugs", response_model=List[BugResponse])
async def get_bugs(status: Optional[str] = Query(None, description="Filtrer par statut")):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT id, name, TO_CHAR(description), priority, status, url, created_at, test_session_id FROM bugs"
    params = {}
    if status:
        query += " WHERE status = :status"
        params["status"] = status
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Construire la liste des bugs AVANT de fermer la connexion
    bugs = []
    for r in rows:
        bugs.append({
            "id": r[0],
            "name": r[1],
            "description": r[2],  # TO_CHAR donne directement une string
            "priority": r[3],
            "status": r[4],
            "url": r[5],
            "created_at": r[6] if r[6] is not None else None,
            "test_session_id": r[7] if r[7] is not None else None
        })
    
    cursor.close()
    conn.close()
    
    print(f"🐞 Bugs retournés : {len(bugs)}")
    return bugs


@router.post("/bugs/{bug_id}/fix")
async def fix_bug(bug_id: str, request: FixRequest):
    """Marque un bug comme corrigé (statut FIXED)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM bugs WHERE id = :id", id=bug_id)
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Bug introuvable")

    cursor.execute(
        "UPDATE bugs SET status = 'FIXED' WHERE id = :id",
        id=bug_id
    )
    conn.commit()
    cursor.close()
    conn.close()

    print(f"🔧 Bug {bug_id} corrigé par {request.tester}")
    return {"message": "Bug corrigé", "bug_id": bug_id, "status": "FIXED"}


@router.post("/bugs/{bug_id}/test")
async def test_bug(bug_id: str, request: TestRequest):
    """Enregistre le résultat d'un test de non-régression sur un bug.

    - PASS -> le bug est considéré comme corrigé (status = FIXED)
    - FAIL -> le bug reste ouvert (status = OPEN)
    """
    result = request.result.upper()
    if result not in ("PASS", "FAIL"):
        raise HTTPException(status_code=400, detail="result doit être PASS ou FAIL")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM bugs WHERE id = :id", id=bug_id)
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Bug introuvable")

    new_status = "FIXED" if result == "PASS" else "OPEN"
    cursor.execute(
        "UPDATE bugs SET status = :status WHERE id = :id",
        status=new_status, id=bug_id
    )
    conn.commit()
    cursor.close()
    conn.close()

    print(f"🧪 Test {result} sur {bug_id} par {request.tester} -> statut {new_status}")
    return {"message": f"Test {result} enregistré", "bug_id": bug_id, "status": new_status}