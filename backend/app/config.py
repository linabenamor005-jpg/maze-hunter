import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DB_USER: str = os.getenv("DB_USER")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD")
    DB_DSN: str = os.getenv("DB_DSN")
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM")

settings = Settings()