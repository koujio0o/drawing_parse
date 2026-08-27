export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  tool: 'pen' | 'eraser';
  color: string;
  width: number;
  points: Point[];
}
