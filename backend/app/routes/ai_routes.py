from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_ollama import generate_test_cases_from_feature

router = APIRouter()

class FeatureTestCaseRequest(BaseModel):
    feature_description: str
    test_types: list[str]

class BugTestCaseRequest(BaseModel):
    bug_name: str
    bug_description: str
    bug_priority: str

@router.post("/generate-tests-from-feature")
async def generate_tests_from_feature(request: FeatureTestCaseRequest):
    try:
        test_cases = generate_test_cases_from_feature(
            request.feature_description,
            request.test_types
        )
        return {"test_cases": test_cases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-tests-from-bug")
async def generate_tests_from_bug(request: BugTestCaseRequest):
    try:
        test_cases = generate_test_cases_from_bug(
            request.bug_name,
            request.bug_description,
            request.bug_priority
        )
        return {"test_cases": test_cases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))