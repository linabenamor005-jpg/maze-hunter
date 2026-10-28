import oracledb
from app.config import settings

def get_db_connection():
    """Retourne une connexion Oracle."""
    return oracledb.connect(
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        dsn=settings.DB_DSN
    )