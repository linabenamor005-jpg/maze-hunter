from fastapi import APIRouter
from app.database import get_db_connection

router = APIRouter()

@router.get("/sessions")
async def get_sessions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, target_url, started_at, finished_at, status
        FROM test_sessions
        ORDER BY started_at DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {
            "id": r[0],
            "url": r[1],
            "started_at": r[2],
            "finished_at": r[3],
            "status": r[4]
        }
        for r in rows
    ]