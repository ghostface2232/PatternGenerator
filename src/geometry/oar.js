// Theoretical open-area ratio from the pattern's unit cell (industry standard for
// clean infinite patterns). Counted OAR (visible hole area / perforated area) is
// used instead whenever margins, corner radius, removal, variation or radial mode
// make the unit cell meaningless — see core/pipeline.js.
export function calcTheoreticalOAR(patternType, pitchX, pitchY, holeArea) {
  let cellArea;
  if (patternType === "Staggered 60°") {
    cellArea = pitchX * (pitchX * Math.sqrt(3) / 2);
  } else if (patternType === "Staggered 45°") {
    cellArea = pitchX * pitchX;
  } else {
    // Straight, Custom Angle — rectangular cell
    cellArea = pitchX * pitchY;
  }
  if (cellArea <= 0) return 0;
  return Math.min((holeArea / cellArea) * 100, 100);
}
