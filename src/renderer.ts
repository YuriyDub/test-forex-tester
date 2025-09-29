import { COLORS, FONTS } from './constants';
import type { Bar } from './types';
import { formatNumber } from './utils';

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D, private canvas: HTMLCanvasElement) {}

  private withSaveRestore(fn: () => void) {
    this.ctx.save();
    fn();
    this.ctx.restore();
  }

  private drawText(
    text: string,
    x: number,
    y: number,
    align: CanvasTextAlign = 'right',
    baseline: CanvasTextBaseline = 'middle',
    font: string = FONTS.small,
    color: string = COLORS.text,
  ) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground() {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawPriceScale(right: number, top: number, bottom: number, min: number, max: number) {
    this.withSaveRestore(() => {
      const { ctx } = this;

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(right - 80, top, 80, bottom - top);

      const gridLines = 10;
      for (let i = 0; i <= gridLines; i++) {
        const y = top + (i / gridLines) * (bottom - top);
        const price = max - (i / gridLines) * (max - min);

        this.drawText(price.toFixed(5), right - 8, y);

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(right - 82, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.stroke();
      }
    });
  }

  drawVolumeScale(right: number, max: number) {
    this.withSaveRestore(() => {
      const { ctx, canvas } = this;
      const bottom = canvas.clientHeight;
      const top = bottom - 50;

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(right - 80, top, 80, bottom - top);

      const y = bottom - 0.5 * (bottom - top);
      const halfMax = 0.5 * max;

      this.drawText(formatNumber(halfMax), right - 8, y);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(right - 82, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.stroke();
    });
  }

  drawDateLabels(
    bottom: number,
    left: number,
    width: number,
    indicesToTimes: (i: number) => number,
    visibleStart: number,
    visibleCount: number,
  ) {
    this.withSaveRestore(() => {
      const { ctx } = this;
      ctx.fillStyle = COLORS.text;
      ctx.font = FONTS.small;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelEvery = Math.max(1, Math.floor(visibleCount / 5));

      for (let i = labelEvery / 2; i < visibleCount - labelEvery / 2; i += labelEvery) {
        const idx = Math.floor(visibleStart + i);
        const x = left + (i * width) / visibleCount;
        const t = indicesToTimes(idx);
        if (!t) continue;

        const d = new Date(t * 1000);
        const txt = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
          d.getUTCDate(),
        ).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(
          d.getUTCMinutes(),
        ).padStart(2, '0')}`;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, bottom);
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.stroke();

        ctx.fillText(txt, x, bottom + 4);
      }
    });
  }

  drawBars(
    left: number,
    top: number,
    bottom: number,
    bars: Bar[],
    startIndex: number,
    visibleCount: number,
    minPrice: number,
    maxPrice: number,
    barWidth: number,
    spacing: number,
  ) {
    this.withSaveRestore(() => {
      const { ctx } = this;

      const priceToY = (p: number) =>
        top + ((maxPrice - p) / (maxPrice - minPrice)) * (bottom - top);

      for (let i = 0; i < visibleCount; i++) {
        const idx = Math.floor(startIndex + i);
        const bar = bars[idx];
        if (!bar) break;

        const bull = bar.Close >= bar.Open;
        const color = bull ? COLORS.bull : COLORS.bear;
        const x = left + i * (barWidth + spacing);

        const o = priceToY(bar.Open);
        const h = priceToY(bar.High);
        const l = priceToY(bar.Low);
        const c = priceToY(bar.Close);

        ctx.beginPath();
        ctx.moveTo(x + barWidth / 2, h);
        ctx.lineTo(x + barWidth / 2, l);
        ctx.lineWidth = Math.max(1, Math.floor(barWidth / 8));
        ctx.strokeStyle = color;
        ctx.stroke();

        const bodyTop = Math.min(o, c);
        const bodyBottom = Math.max(o, c);
        ctx.fillStyle = color;
        ctx.fillRect(x, bodyTop, barWidth, Math.max(1, bodyBottom - bodyTop));
      }
    });
  }

  drawGraph(
    left: number,
    top: number,
    bottom: number,
    bars: Bar[],
    startIndex: number,
    visibleCount: number,
    minPrice: number,
    maxPrice: number,
    barWidth: number,
    spacing: number,
  ) {
    this.withSaveRestore(() => {
      const { ctx } = this;

      const priceToY = (p: number) =>
        top + ((maxPrice - p) / (maxPrice - minPrice)) * (bottom - top);

      const startBar = bars[startIndex + 0];
      const startClose = priceToY(startBar.Close);
      ctx.beginPath();
      ctx.moveTo(left + barWidth / 2, startClose);

      for (let i = 0; i < visibleCount; i++) {
        const idx = Math.floor(startIndex + i);
        const bar = bars[idx];
        const nextBar = bars[idx + 1];
        if (!bar || !nextBar) break;

        const x = left + i * (barWidth + spacing);
        const nextX = left + (i + 1) * (barWidth + spacing);

        const close = priceToY(bar.Close);
        const nextClose = priceToY(nextBar.Close);

        const xc = (x + nextX + barWidth) / 2;
        const yc = (close + nextClose) / 2;
        ctx.quadraticCurveTo(x + barWidth / 2, close, xc, yc);
      }

      ctx.lineWidth = Math.max(1, Math.floor(barWidth / 8));
      ctx.strokeStyle = COLORS.panelBorder;
      ctx.stroke();
    });
  }

  drawTickVolumes(
    left: number,
    bars: Bar[],
    startIndex: number,
    visibleCount: number,
    maxVolume: number,
    barWidth: number,
    spacing: number,
  ) {
    this.withSaveRestore(() => {
      const { ctx, canvas } = this;
      const normalizeVolume = (v: number) => (v / maxVolume) * 50;

      for (let i = 0; i < visibleCount; i++) {
        const idx = Math.floor(startIndex + i);
        const bar = bars[idx];
        if (!bar) break;

        const bull = bar.Close >= bar.Open;
        const color = bull ? COLORS.bull : COLORS.bear;
        const x = left + i * (barWidth + spacing);

        ctx.fillStyle = color;
        ctx.fillRect(x, canvas.clientHeight, barWidth, -normalizeVolume(bar.TickVolume));
      }
    });
  }

  drawLoadingIndicator(progress: number, message: string) {
    this.withSaveRestore(() => {
      const { ctx, canvas } = this;
      const centerX = canvas.clientWidth / 2;
      const centerY = canvas.clientHeight / 2;

      ctx.fillStyle = COLORS.overlay;
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const container = { w: 300, h: 120, r: 12 };
      const x = centerX - container.w / 2;
      const y = centerY - container.h / 2;

      ctx.fillStyle = COLORS.panel;
      ctx.strokeStyle = COLORS.panelBorder;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(x, y, container.w, container.h, container.r);
      ctx.fill();
      ctx.stroke();

      const pb = {
        w: container.w - 40,
        h: 8,
        x: x + 20,
        y: y + 60,
        r: 4,
      };

      // Background
      ctx.fillStyle = COLORS.panelBorder;
      ctx.beginPath();
      ctx.roundRect(pb.x, pb.y, pb.w, pb.h, pb.r);
      ctx.fill();

      // Fill
      const fillWidth = (pb.w * progress) / 100;
      if (fillWidth > 0) {
        const gradient = ctx.createLinearGradient(pb.x, pb.y, pb.x + fillWidth, pb.y);
        gradient.addColorStop(0, COLORS.bull);
        gradient.addColorStop(1, '#1e8b5f');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(pb.x, pb.y, fillWidth, pb.h, pb.r);
        ctx.fill();
      }

      this.drawText(
        `${Math.round(progress)}%`,
        centerX,
        pb.y - 15,
        'center',
        'middle',
        FONTS.medium,
      );

      this.drawText(message, centerX, pb.y + 35, 'center', 'middle', FONTS.large, '#ffffff');

      const spinnerR = 12;
      const spinnerX = centerX;
      const spinnerY = y + 25;
      const time = Date.now() * 0.005;

      ctx.strokeStyle = COLORS.bull;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(spinnerX, spinnerY, spinnerR, time, time + Math.PI * 1.5);
      ctx.stroke();
    });
  }
}
