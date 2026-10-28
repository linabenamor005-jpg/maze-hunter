import { Injectable } from '@angular/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThreeLoaderService {
  private loader = new GLTFLoader();

  loadModel(path: string): Observable<any> {
    return new Observable(observer => {
      this.loader.load(
        path,
        (gltf) => { observer.next(gltf); observer.complete(); },
        undefined,
        (error) => observer.error(error)
      );
    });
  }
}