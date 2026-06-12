// Random-but-deterministic blue dot scatter for hero backgrounds.
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
window.paintDots = function (
  svg,
  { seed = 42, count = 520, minDist = 38, w = 2240, h = 1180 } = {}
) {
  const rand = mulberry32(seed);
  const placed = [];
  let tries = 0;
  while (placed.length < count && tries < count * 40) {
    tries++;
    const x = rand() * w;
    const y = rand() * h;
    let ok = true;
    for (const p of placed) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDist * minDist) {
        ok = false;
        break;
      }
    }
    if (ok) placed.push({ x, y });
  }
  const ns = 'http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  for (const p of placed) {
    const r = 1.6 + rand() * rand() * 5.5;
    const op = 0.22 + rand() * 0.55;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', p.x.toFixed(1));
    c.setAttribute('cy', p.y.toFixed(1));
    c.setAttribute('r', r.toFixed(2));
    c.setAttribute('fill', '#2563eb');
    c.setAttribute('opacity', op.toFixed(2));
    svg.appendChild(c);
  }
};
