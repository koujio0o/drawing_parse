export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  tool: 'pen' | 'eraser';
  color: string;
  width: number;
  points: Point[];
}
