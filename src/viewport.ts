export class Viewport {
  public offsetIndex = 0;
  public barWidth = 6;
  public spacing = 1;
  public maxBarWidth = 20;

  constructor(public visibleCount = 200) {
    this.visibleCount = visibleCount;
  }

  zoomAt(mouseX: number, zoomFactor: number) {
    const centerIndexFloat = this.offsetIndex + mouseX / (this.barWidth + this.spacing);
    const newBarWidth = Math.max(1, Math.min(this.maxBarWidth, this.barWidth * zoomFactor));

    if (Math.abs(newBarWidth - this.barWidth) < 0.01) return;
    const newOffset = centerIndexFloat - mouseX / (newBarWidth + this.spacing);
    this.barWidth = newBarWidth;
    this.offsetIndex = Math.max(0, newOffset);
  }

  panBy(deltaPx: number) {
    const panSensitivity = 1; // Shorter steps for more precise control
    const deltaIndex = (deltaPx * panSensitivity) / (this.barWidth + this.spacing);
    this.offsetIndex = Math.max(0, this.offsetIndex - deltaIndex);
  }
}