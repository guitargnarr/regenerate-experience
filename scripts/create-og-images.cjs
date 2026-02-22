/**
 * Generate OG images for Regenerate experience.
 * Lorenz attractor on green-black with Playfair Display title.
 */

const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;

// Lorenz system
function integrateLorenz(steps) {
  const SIGMA = 10, RHO = 28, BETA = 8 / 3, DT = 0.005;
  const points = [];
  let x = 0.1, y = 0, z = 0;

  for (let i = 0; i < steps; i++) {
    const dx = SIGMA * (y - x);
    const dy = x * (RHO - z) - y;
    const dz = x * y - BETA * z;
    x += dx * DT;
    y += dy * DT;
    z += dz * DT;
    points.push({ x, y: z, z: y }); // Swap for visual clarity
  }
  return points;
}

function createOG(outputPath, w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0d08';
  ctx.fillRect(0, 0, w, h);

  // Subtle radial glow
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.4);
  glow.addColorStop(0, 'rgba(74, 124, 89, 0.08)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Draw Lorenz attractor
  const points = integrateLorenz(6000);

  // Find bounds for scaling
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const scaleX = (w * 0.5) / (maxX - minX);
  const scaleY = (h * 0.55) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = w * 0.5;
  const offsetY = h * 0.42;

  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const px = (p.x - (minX + maxX) / 2) * scale + offsetX;
    const py = (p.y - (minY + maxY) / 2) * scale + offsetY;

    // Color gradient: moss -> gold -> cream
    const t = i / points.length;
    let r, g, b;
    if (t < 0.33) {
      const s = t / 0.33;
      r = Math.round(74 + s * 127);
      g = Math.round(124 - s * 23);
      b = Math.round(89 - s * 40);
    } else if (t < 0.66) {
      const s = (t - 0.33) / 0.33;
      r = Math.round(201 + s * 27);
      g = Math.round(168 + s * 52);
      b = Math.round(76 + s * 122);
    } else {
      r = 228; g = 220; b = 200;
    }

    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py);
    }
  }

  ctx.globalAlpha = 1;

  // Title text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a7c59';
  ctx.font = 'bold 52px "Playfair Display", Georgia, serif';
  ctx.fillText('REGENERATE', w / 2, h * 0.15);

  // Subtitle
  ctx.fillStyle = '#7a8a72';
  ctx.font = '300 16px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText('The story of what was already happening', w / 2, h * 0.21);

  // Bottom attribution
  ctx.fillStyle = 'rgba(74, 124, 89, 0.4)';
  ctx.font = '300 12px "IBM Plex Mono", monospace';
  ctx.fillText('Project Lavos', w / 2, h * 0.93);

  // Edge vignette
  const edgeGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  edgeGrad.addColorStop(0, 'transparent');
  edgeGrad.addColorStop(1, 'rgba(10, 13, 8, 0.5)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buf);
  console.log(`Created: ${outputPath} (${(buf.length / 1024).toFixed(1)} KB)`);
}

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

createOG(path.join(publicDir, 'og-image.png'), 1200, 630);
createOG(path.join(publicDir, 'social-preview.png'), 1200, 630);

console.log('Done.');
