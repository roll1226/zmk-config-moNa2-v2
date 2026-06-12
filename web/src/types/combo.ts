export interface Combo {
  id: string;
  name: string;
  binding: string;
  keyPositions: number[];
  timeoutMs: number;
  layers?: number[];
  requirePriorIdleMs?: number;
}
