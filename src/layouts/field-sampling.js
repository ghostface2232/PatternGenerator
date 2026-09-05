// How a layout that places whole LINES of holes reads a two-dimensional field.
//
// The grid family moves a row at a time and Cross-hatch moves a line at a time,
// so each has to turn the spacing field along that line into one number. Three
// answers were tried and only the third is honest:
//
//   one fixed point   the row's centre. Cheap, and blind to everything off the
//                     midline — a controller on the left half of the sheet lit
//                     up the canvas heat map and moved not one hole.
//   the mean          sees the whole row, but scales the effect by how much of
//                     the row the controller covers, so a controller reaching a
//                     fifth of the sheet came out at a fifth of its strength and
//                     the Target slider stopped meaning what it says.
//   the strongest     what this does: the value furthest from the channel's
//                     neutral 1×. For a point controller that is the value at
//                     the line's closest approach to it, so a line reads a
//                     controller by how far away it is and by nothing else —
//                     which is exactly as much as a line can say about a field,
//                     and it says it the same wherever along the line the
//                     controller happens to sit.
//
// Deviation is measured as a ratio rather than a difference, so that 0.5× and 2×
// count as equally strong — they are the same change to the pitch, one each way.
//
// Sampling is uniform over the segment, so a controller much narrower than the
// sample step can be missed. At the counts the callers use that is a few
// millimetres on a full sheet, below what the canvas heat map resolves.

const NEUTRAL = 1;

export function strongestAlong(spacing, ax, ay, bx, by, samples) {
  let best = NEUTRAL;
  let bestDeviation = 1;
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) / samples;
    const value = spacing.sample(ax + (bx - ax) * t, ay + (by - ay) * t);
    const deviation = value > NEUTRAL ? value / NEUTRAL : NEUTRAL / value;
    if (deviation > bestDeviation) {
      bestDeviation = deviation;
      best = value;
    }
  }
  return best;
}
