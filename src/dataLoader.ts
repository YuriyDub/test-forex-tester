import type { Bar, BarChunk } from './types.ts';

export class DataLoader {
  async loadForexTesterChunk(params: {
    Broker: string;
    Symbol: string;
    Timeframe: number;
    Start: number;
    End: number;
    UseMessagePack?: boolean;
    url?: string;
    onProgress?: (progress: number, message: string) => void;
  }): Promise<Bar[]> {
    const base = params.url ?? 'https://beta.forextester.com/data/api/Metadata/bars/chunked';
    const q = `?Broker=${encodeURIComponent(params.Broker)}&Symbol=${encodeURIComponent(
      params.Symbol,
    )}&Timeframe=${params.Timeframe}&Start=${params.Start}&End=${params.End}&UseMessagePack=${
      params.UseMessagePack ? 'true' : 'false'
    }`;

    // Report progress: Starting request
    params.onProgress?.(10, 'Connecting to server...');

    const res = await fetch(base + q);
    if (!res.ok) throw new Error('Failed to fetch data: ' + res.statusText);

    // Report progress: Data received
    params.onProgress?.(50, 'Processing data...');

    const json = await res.json();

    // Handle direct array of bar objects
    if (Array.isArray(json)) {
      // Check if it's the new format with direct bar objects
      if (json.length > 0 && typeof json[0] === 'object' && 'Time' in json[0]) {
        // Direct array of bar objects - just sort and return
        params.onProgress?.(80, 'Sorting data...');
        const bars = json as Bar[];
        bars.sort((a, b) => a.Time - b.Time);
        params.onProgress?.(100, 'Data loaded successfully!');
        return bars;
      }

      // Handle old chunked format
      params.onProgress?.(70, 'Processing chunks...');
      const bars: Bar[] = [];
      const totalChunks = json.length;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = json[i] as BarChunk;
        const start = chunk.ChunkStart;
        for (const entry of chunk.Bars) {
          const {Time, Open, High, Low, Close, TickVolume } = entry;
          bars.push({
            Time: Time + start,
            Open: Open ?? 0,
            High: High ?? 0,
            Low: Low ?? 0,
            Close: Close ?? 0,
            TickVolume,
          });
        }

        // Update progress for each chunk
        const chunkProgress = 70 + (i / totalChunks) * 20;
        params.onProgress?.(chunkProgress, `Processing chunk ${i + 1}/${totalChunks}...`);
      }

      params.onProgress?.(95, 'Sorting data...');
      bars.sort((a, b) => a.Time - b.Time);
      params.onProgress?.(100, 'Data loaded successfully!');
      return bars;
    }

    throw new Error('Unexpected data format');
  }
}
