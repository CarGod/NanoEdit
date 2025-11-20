
export interface ImageSession {
  id: string;
  file: File | null; // Null if blank canvas
  originalUrl: string | null; // Null if blank canvas
  maskUrl: string | null; // Data URL of the drawn mask
  compositeUrl: string | null; // The combined image (bg + drawings) to send to AI
  isDirty: boolean;
}

export type ToolType = 'brush' | 'eraser' | 'rect' | 'circle';
export type DrawMode = 'mask' | 'sketch';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  type: 'freehand';
  points: Point[];
  size: number;
  color: string;
  isMask: boolean; // True = Red Mask, False = Colored Sketch
}

export interface Shape {
  type: 'rect' | 'circle';
  start: Point;
  end: Point;
  color: string;
  size: number;
  isMask: boolean;
}

export type DrawingElement = Stroke | Shape;
