// Generates the HMSC mission-patch logo (SVG). Run: node make-logo.js
const fs = require('fs');
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const f = n => +n.toFixed(1);

// ---- centre line: heartbeat that becomes a comet tail -----------------------------------------------------
const ecg = [[140, 650], [250, 650], [276, 633], [300, 650], [332, 650], [352, 700], [388, 500], [428, 765], [460, 650], [492, 650], [518, 619], [548, 650], [575, 650]];
const chaikin = (p, n) => { for (let k = 0; k < n; k++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const [a, b] = [p[i], p[i + 1]]; q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } q.push(p[p.length - 1]); p = q; } return p; };
const ecgPts = chaikin(ecg, 2);
const cub = (p0, p1, p2, p3, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]; });
const HEAD = [800, 285];
const arc = cub([575, 650], [700, 650], [735, 470], HEAD, 70);
const center = [...ecgPts, ...arc.slice(1)];
// cumulative length -> param
const len = [0]; for (let i = 1; i < center.length; i++) len.push(len[i - 1] + Math.hypot(center[i][0] - center[i - 1][0], center[i][1] - center[i - 1][1]));
const L = len[len.length - 1], arcStart = len[ecgPts.length - 1] / L;
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const normal = i => { const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [-dy / m, dx / m]; };
/** A ribbon along the centre line between parameters [t0,t1] with the given width profile and sideways offset. */
function ribbon(t0, t1, width, off = 0) {
  const idx = center.map((_, i) => i).filter(i => len[i] / L >= t0 && len[i] / L <= t1);
  const left = [], right = [];
  for (const i of idx) { const t = len[i] / L, [nx, ny] = normal(i), w = width(t) / 2, c = [center[i][0] + nx * off, center[i][1] + ny * off]; left.push([c[0] + nx * w, c[1] + ny * w]); right.push([c[0] - nx * w, c[1] - ny * w]); }
  const pts = [...left, ...right.reverse()];
  return 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
}
const main = ribbon(0, 1, t => (t < arcStart ? 9 : 9 + 20 * Math.pow(ss(arcStart, 1, t), 1.5)));
const streakA = ribbon(arcStart + 0.02, 0.99, t => 2 + 12 * ss(arcStart, 1, t), 34), streakB = ribbon(arcStart + 0.06, 0.985, t => 2 + 9 * ss(arcStart, 1, t), -30), streakC = ribbon(arcStart + 0.12, 0.98, t => 1.5 + 6 * ss(arcStart, 1, t), 62);

// ---- sky -------------------------------------------------------------------------------------------------
let stars = '';
for (let i = 0; i < 130; i++) {
  const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 455, x = 512 + Math.cos(a) * r, y = 512 + Math.sin(a) * r, big = rnd() < 0.08, s = big ? 2.6 + rnd() * 1.6 : 0.7 + rnd() * 1.5;
  stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="${rnd() < 0.2 ? '#FFD9B8' : '#EAF0FF'}" opacity="${f(0.35 + rnd() * 0.65)}"/>`;
  if (big) stars += `<path d="M${f(x - 12)} ${f(y)}H${f(x + 12)}M${f(x)} ${f(y - 12)}V${f(y + 12)}" stroke="#EAF0FF" stroke-width="1.2" opacity="0.45" stroke-linecap="round"/>`;
}
// patch ring tick marks
let ticks = ''; for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, r1 = 468, r2 = i % 6 === 0 ? 452 : 460; ticks += `<path d="M${f(512 + Math.cos(a) * r1)} ${f(512 + Math.sin(a) * r1)}L${f(512 + Math.cos(a) * r2)} ${f(512 + Math.sin(a) * r2)}" stroke="#D9A074" stroke-width="${i % 6 === 0 ? 3 : 1.6}" opacity="0.85"/>`; }

const defs = `<defs>
  <radialGradient id="sky" cx="0.62" cy="0.34" r="0.85"><stop offset="0" stop-color="#1B2447"/><stop offset="0.55" stop-color="#0B1022"/><stop offset="1" stop-color="#04050C"/></radialGradient>
  <radialGradient id="neb1" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#B8693F" stop-opacity="0.35"/><stop offset="1" stop-color="#B8693F" stop-opacity="0"/></radialGradient>
  <radialGradient id="neb2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#5A4FCF" stop-opacity="0.28"/><stop offset="1" stop-color="#5A4FCF" stop-opacity="0"/></radialGradient>
  <radialGradient id="mars" cx="0.3" cy="0.25" r="0.9"><stop offset="0" stop-color="#E9966A"/><stop offset="0.5" stop-color="#B8532F"/><stop offset="1" stop-color="#3A1608"/></radialGradient>
  <radialGradient id="coma" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF6E6" stop-opacity="0.95"/><stop offset="0.25" stop-color="#FFD39B" stop-opacity="0.55"/><stop offset="1" stop-color="#FF9A4A" stop-opacity="0"/></radialGradient>
  <linearGradient id="trail" x1="140" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C9763F" stop-opacity="0"/><stop offset="0.18" stop-color="#D98A55" stop-opacity="0.9"/><stop offset="0.55" stop-color="#F2B27B"/><stop offset="0.85" stop-color="#FFE3BF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0B58A"/><stop offset="0.5" stop-color="#B8693F"/><stop offset="1" stop-color="#E7A072"/></linearGradient>
  <filter id="blur6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
  <clipPath id="disc"><circle cx="512" cy="512" r="440"/></clipPath>
</defs>`;

const patch = `${defs}
<circle cx="512" cy="512" r="500" fill="#0A0D1A"/>
<circle cx="512" cy="512" r="492" fill="none" stroke="url(#ring)" stroke-width="10"/>
<circle cx="512" cy="512" r="474" fill="none" stroke="#D9A074" stroke-width="1.5" opacity="0.7"/>
${ticks}
<g clip-path="url(#disc)">
  <rect width="1024" height="1024" fill="url(#sky)"/>
  <ellipse cx="250" cy="330" rx="330" ry="210" fill="url(#neb2)" transform="rotate(-24 250 330)"/>
  <ellipse cx="760" cy="760" rx="330" ry="170" fill="url(#neb1)" transform="rotate(-18 760 760)"/>
  ${stars}
  <!-- planet limb -->
  <circle cx="300" cy="1560" r="800" fill="url(#mars)"/>
  <circle cx="300" cy="1560" r="800" fill="none" stroke="#FFC08A" stroke-width="5" opacity="0.55"/>
  <circle cx="300" cy="1560" r="806" fill="none" stroke="#FF9A4A" stroke-width="12" opacity="0.18" filter="url(#blur3)"/>
  <!-- comet: glow, trail, nucleus -->
  <g filter="url(#blur6)" opacity="0.9"><path d="${main}" fill="url(#trail)"/></g>
  <path d="${streakC}" fill="url(#trail)" opacity="0.35"/><path d="${streakB}" fill="url(#trail)" opacity="0.5"/><path d="${streakA}" fill="url(#trail)" opacity="0.6"/>
  <path d="${main}" fill="url(#trail)"/>
  <circle cx="${HEAD[0]}" cy="${HEAD[1]}" r="118" fill="url(#coma)"/>
  <circle cx="${HEAD[0]}" cy="${HEAD[1]}" r="23" fill="#FFFFFF"/>
  <circle cx="${HEAD[0] - 6}" cy="${HEAD[1] - 6}" r="9" fill="#FFF1DA"/>
</g>`;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="HMSC mission patch">${patch}</svg>`;
fs.writeFileSync('logo-icon.svg', iconSvg);

// app-icon version: full-bleed square (stores round the corners themselves)
fs.writeFileSync('logo-app-icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}<rect width="1024" height="1024" fill="#0A0D1A"/>${patch.slice(patch.indexOf('<g clip-path')).replace('<g clip-path="url(#disc)">', '<g transform="translate(512 540) scale(1.12) translate(-512 -512)">')}</svg>`);

const word = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 400" width="1500" height="400" role="img" aria-label="HMSC · Health Monitoring System Cometa">${dark ? '<rect width="1500" height="400" fill="#070A15"/>' : ''}<g transform="translate(10 8) scale(0.38)">${patch}</g>
  <text x="440" y="222" font-family="'Geist','Helvetica Neue',Helvetica,Arial,sans-serif" font-size="150" font-weight="700" letter-spacing="6" fill="${dark ? '#FFFFFF' : '#1B1410'}">HMSC</text>
  <path d="M446 250H1010" stroke="#B8693F" stroke-width="2.5" opacity="0.8"/>
  <text x="446" y="298" font-family="'Geist','Helvetica Neue',Helvetica,Arial,sans-serif" font-size="34" font-weight="500" letter-spacing="3.2" fill="${dark ? '#E7A072' : '#B8693F'}">HEALTH MONITORING SYSTEM COMETA</text></svg>`;
fs.writeFileSync('logo-horizontal.svg', word(false)); fs.writeFileSync('logo-horizontal-dark.svg', word(true));
// mark only: the comet-heartbeat line on transparent
fs.writeFileSync('logo-mark.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}<g filter="url(#blur6)" opacity="0.5"><path d="${main}" fill="#B8693F"/></g><path d="${streakA}" fill="#B8693F" opacity="0.5"/><path d="${main}" fill="#B8693F"/><circle cx="${HEAD[0]}" cy="${HEAD[1]}" r="26" fill="#B8693F"/></svg>`);
