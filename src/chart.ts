import type { Bar, ChartConfig } from './types';
import { DataLoader } from './dataLoader';
import { Viewport } from './viewport';
import { Renderer } from './renderer';

export class Chart {
  private ctx: CanvasRenderingContext2D;
  private renderer: Renderer;

  private bars: Bar[] = [];
  private viewport = new Viewport(200);

  private animHandle: number | null = null;

  private dragging = false;
  private lastDragX = 0;
  private lastMouseMoveTime = 0;
  private lastPanTime = 0;
  private mouseMoveThrottle = 16; // ~60fps
  private panVelocity = 0;
  private isPanning = false;

  // Loading state
  private isLoading = false;
  private loadingProgress = 0;
  private loadingMessage = 'Loading data...';

  constructor(
    private canvas: HTMLCanvasElement,
    private config: ChartConfig = { showVolume: false },
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    this.ctx = ctx;
    this.renderer = new Renderer(ctx, canvas);

    this.setupInteraction();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.scheduleRender();
  }

  setInitialData(bars: Bar[]) {
    this.bars = bars.slice();
    this.viewport.offsetIndex = Math.max(0, this.bars.length - this.viewport.visibleCount);
    this.scheduleRender();
  }

  setLoading(loading: boolean, progress = 0, message = 'Loading data...') {
    this.isLoading = loading;
    this.loadingProgress = Math.max(0, Math.min(100, progress));
    this.loadingMessage = message;
    this.scheduleRender();
  }

  async loadData(params: {
    Broker: string;
    Symbol: string;
    Timeframe: number;
    Start: number;
    End: number;
    UseMessagePack?: boolean;
    url?: string;
  }) {
    const loader = new DataLoader();

    try {
      this.setLoading(true, 0, 'Starting data load...');

      const bars = await loader.loadForexTesterChunk({
        ...params,
        onProgress: (progress, message) => this.setLoading(true, progress, message),
      });

      this.setInitialData(bars);
      this.setLoading(false);
    } catch (error) {
      this.setLoading(false);
      throw error;
    }
  }

  setSize(left: number, top: number, width: number, height: number) {
    this.canvas.style.left = left + 'px';
    this.canvas.style.top = top + 'px';
    this.canvas.width = width;
    this.canvas.height = height;
    this.scheduleRender();
  }

  private scheduleRender() {
    if (this.animHandle) return;
    this.animHandle = requestAnimationFrame(() => {
      this.animHandle = null;
      this.render();
    });
  }

  private render() {
    const canvas = this.canvas;
    const additionalOffset = 50;
    const { visibleCount, startIndex } = this.getVisibleRange();

    if (this.viewport.offsetIndex + visibleCount > this.bars.length + additionalOffset) {
      this.viewport.offsetIndex = Math.max(0, this.bars.length - visibleCount + additionalOffset);
    }

    const padding = { left: 10, right: 90, top: 10, bottom: 90 };
    const left = padding.left;
    const right = canvas.width / (window.devicePixelRatio || 1) - padding.right;
    const top = padding.top;
    const bottom = canvas.height / (window.devicePixelRatio || 1) - padding.bottom;

    this.renderer.clear();
    this.renderer.drawBackground();

    if (this.isLoading) {
      this.renderer.drawLoadingIndicator(this.loadingProgress, this.loadingMessage);
      return;
    }

    const { minPrice, maxPrice } = this.calculatePriceRange(startIndex, visibleCount);
    const maxVolume = this.calculateVolumeMax(startIndex, visibleCount);

    // Graph
    this.renderer.drawGraph(
      left,
      top,
      bottom,
      this.bars,
      startIndex,
      visibleCount,
      minPrice,
      maxPrice,
      this.viewport.barWidth,
      this.viewport.spacing,
    );

    // Bars
    this.renderer.drawBars(
      left,
      top,
      bottom,
      this.bars,
      startIndex,
      visibleCount,
      minPrice,
      maxPrice,
      this.viewport.barWidth,
      this.viewport.spacing,
    );

    // Volumes
    if (this.config.showVolume) {
      this.renderer.drawTickVolumes(
        left,
        this.bars,
        startIndex,
        visibleCount,
        maxVolume,
        this.viewport.barWidth,
        this.viewport.spacing,
      );
    }

    // Price/volume scales
    this.renderer.drawPriceScale(
      canvas.width / (window.devicePixelRatio || 1),
      top,
      bottom,
      minPrice,
      maxPrice,
    );
    this.renderer.drawVolumeScale(canvas.width / (window.devicePixelRatio || 1), maxVolume);

    // Dates
    this.renderer.drawDateLabels(
      bottom,
      left,
      right - left,
      this.indicesToTimes,
      startIndex,
      visibleCount,
    );
  }

  private getVisibleRange() {
    const canvasWidth = this.canvas.clientWidth || this.canvas.width;
    const totalBarSpan = this.viewport.barWidth + this.viewport.spacing;
    const visibleCount = Math.floor(canvasWidth / totalBarSpan);
    return { visibleCount, startIndex: Math.floor(this.viewport.offsetIndex) };
  }

  private calculatePriceRange(startIndex: number, visibleCount: number) {
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < visibleCount; i++) {
      const idx = Math.floor(startIndex + i);
      const bar = this.bars[idx];
      if (!bar) break;
      min = Math.min(min, bar.Low);
      max = Math.max(max, bar.High);
    }

    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 1;
    }

    const pad = (max - min) * 0.05 || 1e-6;
    return { minPrice: min - pad, maxPrice: max + pad };
  }

  private calculateVolumeMax(startIndex: number, visibleCount: number) {
    let max = -Infinity;

    for (let i = 0; i < visibleCount; i++) {
      const idx = Math.floor(startIndex + i);
      const bar = this.bars[idx];
      if (!bar) break;
      max = Math.max(max, bar.TickVolume);
    }

    if (!isFinite(max)) max = 1;

    const pad = max * 0.05 || 1e-6;
    return max + pad;
  }

  private indicesToTimes = (i: number) => {
    const bar = this.bars[Math.floor(i)];
    return bar ? bar.Time : 0;
  };

  private resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scheduleRender();
  }

  private updateMomentum() {
    if (!this.isPanning) return;

    const now = performance.now();
    this.lastPanTime = now;

    if (Math.abs(this.panVelocity) > 0.1) {
      this.viewport.panBy(this.panVelocity);
      this.panVelocity *= 0.97; // friction
      this.scheduleRender();
      requestAnimationFrame(() => this.updateMomentum());
    }
  }

  private setupInteraction() {
    /** Zoom with mouse wheel */
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        const zoomSpeed = 0.02;
        const delta = e.deltaY > 0 ? 1 - zoomSpeed : 1 + zoomSpeed;

        this.viewport.zoomAt(mouseX, delta);
        this.scheduleRender();
      },
      { passive: false },
    );

    /** Mouse drag panning */
    this.canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.isPanning = false;
      this.panVelocity = 0;
      this.lastDragX = e.clientX;
      this.lastPanTime = performance.now();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;

      const now = performance.now();
      if (now - this.lastMouseMoveTime < this.mouseMoveThrottle) return;
      this.lastMouseMoveTime = now;

      const dx = e.clientX - this.lastDragX;
      this.lastDragX = e.clientX;

      const deltaTime = now - this.lastPanTime;
      if (deltaTime > 0) {
        this.panVelocity = (dx / deltaTime) * 16; // scale to frame rate
      }
      this.lastPanTime = now;

      this.viewport.panBy(dx);
      this.scheduleRender();
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
      this.isPanning = true;
      this.updateMomentum();
    });

    this.canvas.addEventListener('dblclick', () => {
      this.isPanning = false;
      this.panVelocity = 0;
      this.viewport.barWidth = 6;
      this.viewport.offsetIndex = Math.max(0, this.bars.length - 200);
      this.scheduleRender();
    });

    /** Touch support for mobile */
    let lastTouchX = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      lastTouchX = touch.clientX;
      this.isPanning = false;
      this.panVelocity = 0;
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const now = performance.now();

      if (now - this.lastMouseMoveTime < this.mouseMoveThrottle) return;
      this.lastMouseMoveTime = now;

      const dx = touch.clientX - lastTouchX;
      lastTouchX = touch.clientX;

      const deltaTime = now - this.lastPanTime;
      if (deltaTime > 0) {
        this.panVelocity = (dx / deltaTime) * 16;
      }
      this.lastPanTime = now;

      this.viewport.panBy(dx);
      this.scheduleRender();
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isPanning = true;
      this.updateMomentum();
    });
  }
}
