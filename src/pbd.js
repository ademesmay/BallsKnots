// Simple position-based constraint projection for a chain of unit spheres.
// Neighbor distance == D; non-neighbors must be >= D.

import * as THREE from 'three';

export function projectConstraints(P, D, iters = 5) {
  // P is an array of THREE.Vector3 (clones of current positions)
  for (let k = 0; k < iters; k++) {
    // Enforce exact tangency for neighbors (i, i+1)
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const d = a.distanceTo(b);
      if (d === 0) continue;
      const diff = (d - D) / 2;
      const dir = new THREE.Vector3().subVectors(b, a).multiplyScalar(1 / d);
      a.addScaledVector(dir, +diff);
      b.addScaledVector(dir, -diff);
    }
  }
}

export function resolveOverlaps(P, D, iters = 1) {
  for (let k = 0; k < iters; k++) {
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        if (Math.abs(i - j) === 1) continue; // neighbors handled above
        const a = P[i], b = P[j];
        const v = new THREE.Vector3().subVectors(b, a);
        const d = v.length();
        if (d < D && d > 1e-8) {
          const push = (D - d) / 2;
          v.multiplyScalar(1 / d);
          a.addScaledVector(v, -push);
          b.addScaledVector(v, +push);
        }
      }
    }
  }
}
