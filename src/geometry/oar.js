// Theoretical open-area ratio from the pattern's unit cell (industry standard for
// clean infinite patterns). Counted OAR (visible hole area / perforated area) is
// used instead whenever margins, corner radius, removal, variation, a live field
// channel, or a layout with no lattice at all make the unit cell meaningless —
// see core/pipeline.js.
//
// The cell area is the caller's to work out, and that is the point. This used to
// derive it here from the pattern type and the nominal pitches, and got the
// staggered modes wrong for any hole that is not square: `generateHoles` raises
// the row pitch to whatever the hole's own height and the diagonal neighbour
// distance demand, and a cell built from the nominal pitch alone is smaller than
// the lattice actually drawn. A 3 × 8 mm rectangle on Staggered 60° at a 3 mm
// gap read 77.0% open where 38.0% of it is open — and, being a clean infinite
// pattern, took the theoretical path and put that figure in the readout.
export function calcCellOAR(cellArea, holeArea) {
  if (!(cellArea > 0)) return 0;
  return Math.min((holeArea / cellArea) * 100, 100);
}
