from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BugCreate(BaseModel):
    url: str
    name: str
    description: str
    priority: str  # CRITIQUE, HIGH, MEDIUM, LOW

class BugResponse(BaseModel):
    id: str
    name: str
    description: str
    priority: str
    status: str
    url: str
    created_at: Optional[datetime] = None
    test_session_id: Optional[str] = None

class ScanRequest(BaseModel):
    url: str

class FixRequest(BaseModel):
    tester: str = "hunter"

class TestRequest(BaseModel):
    result: str  # PASS ou FAIL
    tester: str = "hunter"