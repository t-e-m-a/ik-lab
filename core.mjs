// TEMA IK Lab — pure mathematical core, shared by the browser and tests.
// All arms have unit length; all angles are relative and measured in radians.
export function calculate(angles, target) {
  const n = angles.length;
  const points = [{ x: 0, y: 0 }];
  const phases = new Array(n);
  const gradients = new Array(n);
  let x = 0, y = 0, phase = 0;

  for (let i = 0; i < n; i++) {
    phase += angles[i];
    phases[i] = phase;
    x += Math.cos(phase);
    y += Math.sin(phase);
    points.push({ x, y });
  }

  const ex = x - target.x;
  const ey = y - target.y;
  const error = ex * ex + ey * ey;

  // Chain rule: D_i = 2 (x-a) dx/dtheta_i + 2 (y-b) dy/dtheta_i.
  // The i-th joint affects segments i through n. Reverse accumulation is O(n).
  let dx = 0, dy = 0;
  for (let i = n - 1; i >= 0; i--) {
    dx -= Math.sin(phases[i]);
    dy += Math.cos(phases[i]);
    gradients[i] = 2 * (ex * dx + ey * dy);
  }
  return { x, y, points, phases, gradients, error, distance: Math.sqrt(error) };
}

export function gradientStep(angles, target, learningRate) {
  const before = calculate(angles, target);
  if (before.error < 1e-10) return { angles, before, after: before, updated: false, reason: 'target' };
  const gradientSquared = before.gradients.reduce((s, d) => s + d * d, 0);
  if (gradientSquared < 1e-16) return { angles, before, after: before, updated: false, reason: 'stationary' };
  // Fixed-step simultaneous gradient descent; no backtracking or escape heuristics.
  const next = angles.map((a, i) => a - learningRate * before.gradients[i]);
  const after = calculate(next, target);
  return { angles: next, before, after, updated: true, reason: 'updated' };
}
