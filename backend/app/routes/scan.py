from fastapi import APIRouter, BackgroundTasks
from app.models import ScanRequest
from app.services.scanner import run_scan
from app.database import get_db_connection
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/scan")
async def start_scan(request: ScanRequest, background_tasks: BackgroundTasks):
    """Lance un scan asynchrone de l'URL cible."""
    session_id = f"SESS-{uuid.uuid4().hex[:8].upper()}"
    
    # Enregistrer la session
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO test_sessions (id, target_url, status)
        VALUES (:id, :url, 'IN_PROGRESS')
    """, id=session_id, url=request.url)
    conn.commit()
    cursor.close()
    conn.close()

    # Lancer le scan en arrière-plan
    background_tasks.add_task(run_scan, request.url, session_id)

    return {"message": "Scan démarré", "session_id": session_id}