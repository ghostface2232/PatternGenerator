// Pointy-top regular hexagon helpers (circumradius R, oriented for honeycomb tiling).

// Distance from centre to the boundary in a given direction. Edge normals lie at
// multiples of 60°; apothem (centre→edge) = R·√3/2. Used for accurate hexagon
// gap/overlap so the honeycomb ligament reflects the true edge-to-edge spacing.
export function hexEdgeReach(R, dirAngle) {
  const apothem = R * Math.sqrt(3) / 2;
  const sector = Math.PI / 3;
  let d = dirAngle % sector;
  if (d > sector / 2) d -= sector;
  else if (d < -sector / 2) d += sector;
  return apothem / Math.cos(d);
}

export function hexVertices(cx, cy, R) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return pts;
}

export const hexApothem = R => R * Math.sqrt(3) / 2;
