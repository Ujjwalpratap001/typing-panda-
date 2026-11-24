// Tiny canvas chart (lines, dots, bars, optional right axis, tooltip, reference line). No libraries.
import { h } from './util.js';
import { onSettings } from './settings.js';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
const niceMax = v => { if (v <= 0) return 10; const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

// series: [{name, data, color:'--main' | '#hex', kind:'line'|'dots'|'bars', axis:'l'|'r', unit}]
export function chart(container, { labels, series, ref, refLabel, xTitle }) {
  const canvas = h('canvas'), tip = h('div', { class: 'tip-box' });
  const box = h('div', { class: 'chart-box' }, canvas, tip);
  container.append(box);
  const ctx = canvas.getContext('2d');
  let hover = -1;
  const barMode = series.some(s => s.kind === 'bars');
  const hasR = series.some(s => s.axis === 'r');
  const col = c => (c && c.startsWith('--') ? css(c) : c);

  function geometry(W) {
    const pad = { l: 44, r: hasR ? 40 : 12, t: 12, b: 28 };
    return { pad, iw: W - pad.l - pad.r };
  }
  const xAt = (i, n, g) => (barMode ? g.pad.l + g.iw * (i + 0.5) / n : g.pad.l + (n === 1 ? g.iw / 2 : g.iw * i / (n - 1)));

  function draw() {
    const dpr = window.devicePixelRatio || 1, W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const n = labels.length, g = geometry(W), ih = H - g.pad.t - g.pad.b;
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    if (!n) { ctx.fillStyle = css('--sub'); ctx.textAlign = 'center'; ctx.fillText('No data yet', W / 2, H / 2); return; }
    const maxOf = ax => Math.max(...series.filter(s => (s.axis || 'l') === ax).flatMap(s => s.data.filter(Number.isFinite)), ax === 'l' && ref ? ref : 0, 1);
    const maxL = niceMax(maxOf('l')), maxR = hasR ? Math.max(4, niceMax(maxOf('r'))) : 1;
    const y = (v, mx) => g.pad.t + ih * (1 - Math.min(v, mx) / mx);
    ctx.strokeStyle = css('--card-b'); ctx.fillStyle = css('--sub'); ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const yy = g.pad.t + ih * k / 4;
      ctx.beginPath(); ctx.moveTo(g.pad.l, yy); ctx.lineTo(W - g.pad.r, yy); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(Math.round(maxL * (1 - k / 4)), g.pad.l - 6, yy + 4);
      if (hasR) { ctx.textAlign = 'left'; ctx.fillText(Math.round(maxR * (1 - k / 4)), W - g.pad.r + 6, yy + 4); }
    }
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += step) ctx.fillText(labels[i], xAt(i, n, g), H - 8);
    if (ref) { ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--sub'); ctx.beginPath(); ctx.moveTo(g.pad.l, y(ref, maxL)); ctx.lineTo(W - g.pad.r, y(ref, maxL)); ctx.stroke(); ctx.setLineDash([]); ctx.textAlign = 'left'; ctx.fillStyle = css('--sub'); ctx.fillText(refLabel || 'best', g.pad.l + 4, y(ref, maxL) - 5); }
    for (const s of series) {
      const c = col(s.color), mx = s.axis === 'r' ? maxR : maxL;
      ctx.strokeStyle = c; ctx.fillStyle = c;
      if (s.kind === 'bars') {
        const bw = Math.max(2, Math.min(28, (g.iw / n) * 0.62));
        s.data.forEach((v, i) => { if (Number.isFinite(v)) { const yy = y(v, mx); ctx.globalAlpha = hover === i ? 1 : 0.85; ctx.fillRect(xAt(i, n, g) - bw / 2, yy, bw, g.pad.t + ih - yy); } });
        ctx.globalAlpha = 1;
      } else if (s.kind === 'dots') {
        s.data.forEach((v, i) => { if (v > 0) { ctx.beginPath(); ctx.arc(xAt(i, n, g), y(v, mx), 4, 0, 7); ctx.fill(); } });
      } else {
        ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
        s.data.forEach((v, i) => { const px = xAt(i, n, g), py = y(v, mx); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.stroke();
        if (n <= 40) s.data.forEach((v, i) => { ctx.beginPath(); ctx.arc(xAt(i, n, g), y(v, mx), 3, 0, 7); ctx.fill(); });
      }
    }
    if (hover >= 0) {
      const hx = xAt(hover, n, g);
      ctx.strokeStyle = css('--sub'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, g.pad.t); ctx.lineTo(hx, g.pad.t + ih); ctx.stroke();
    }
  }

  function onMove(e) {
    const r = box.getBoundingClientRect(), n = labels.length; if (!n) return;
    const g = geometry(r.width), px = e.clientX - r.left;
    let best = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const d = Math.abs(xAt(i, n, g) - px); if (d < bd) { bd = d; best = i; } }
    hover = best; draw();
    tip.style.display = 'block';
    tip.innerHTML = `<b>${xTitle ? xTitle + ' ' : ''}${labels[best]}</b><br>` + series.map(s => `<span style="color:${col(s.color)}">●</span> ${s.name}: ${Number.isFinite(s.data[best]) ? (+s.data[best]).toFixed(s.digits ?? 1) : '–'}${s.unit || ''}`).join('<br>');
    const tx = Math.min(px + 12, r.width - tip.offsetWidth - 4);
    tip.style.left = Math.max(0, tx) + 'px'; tip.style.top = '8px';
  }
  box.addEventListener('mousemove', onMove);
  box.addEventListener('touchmove', e => onMove(e.touches[0]), { passive: true });
  box.addEventListener('mouseleave', () => { hover = -1; tip.style.display = 'none'; draw(); });
  const ro = new ResizeObserver(draw); ro.observe(box);
  const off = onSettings(k => { if (k === 'theme' || k === '*') requestAnimationFrame(draw); });
  requestAnimationFrame(draw);
  return { redraw: draw, destroy() { ro.disconnect(); off(); } };
}
