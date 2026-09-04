export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const DEG = Math.PI / 180;
export const degToRad = deg => deg * DEG;
export const radToDeg = rad => rad / DEG;
