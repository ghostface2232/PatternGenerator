// Seeded pseudo-random numbers (mulberry32).
//
// The scatter layout is the first thing in this app whose output is not a
// closed-form function of the sliders, and it still has to be one of the
// document: a saved project, a share link and an SVG export must all place the
// same holes, and `removedHoles` indices only mean anything while the list they
// address is reproducible. So there is no Math.random anywhere in the layouts —
// every draw comes from a generator seeded by a number the document carries.
//
// mulberry32 is a 32-bit state PRNG: one multiply-xorshift round per call, a
// period of 2³², and no dependence on the host's RNG. Good enough for placing
// holes and small enough to read.

export function mulberry32(seed) {
  // Zero is a valid state but a poor one (the first few outputs cluster), and
  // the seed arrives from a slider that starts at 0.
  let state = (Math.trunc(seed) >>> 0) + 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
