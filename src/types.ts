export type Bar = {
  Time: number;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  TickVolume: number;
};

export type BarChunk = {
  ChunkStart: number;
  Bars: Array<Bar>;
};

export type ChartConfig = {
  showVolume?: boolean;
};
