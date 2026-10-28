import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  scanUrl(url: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/scan`, { url });
  }

  getBugs(status?: string): Observable<any> {
    const params = status ? `?status=${status}` : '';
    return this.http.get(`${this.baseUrl}/bugs${params}`);
  }

  fixBug(bugId: string, tester: string = 'hunter'): Observable<any> {
    return this.http.post(`${this.baseUrl}/bugs/${bugId}/fix`, { tester });
  }

  testBug(bugId: string, result: 'PASS' | 'FAIL', tester: string = 'hunter'): Observable<any> {
    return this.http.post(`${this.baseUrl}/bugs/${bugId}/test`, { result, tester });
  }

  getSessions(): Observable<any> {
    return this.http.get(`${this.baseUrl}/sessions`);
  }
  generateTestsFromFeature(description: string, testTypes: string[]): Observable<any> {
  return this.http.post(`${this.baseUrl}/generate-tests-from-feature`, {
    feature_description: description,
    test_types: testTypes
  });
}
}