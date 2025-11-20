import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingElement, Point, ToolType, DrawMode } from '../types';
import { Undo, RefreshCcw, Square, Circle, Brush, Eraser } from 'lucide-react';

interface CanvasStageProps {
  imageUrl: string | null;
  aspectRatio: string; // e.g., "1:1", "16:9"
  onUpdate: (compositeUrl: string, maskUrl: string | null) => void;
  isActive: boolean;
}

const COLORS = ['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'];

// Helper to calculate dimensions based on ratio
const getDimensionsFromRatio = (ratio: string) => {
  const [w, h] = ratio.split(':').map(Number);
  const base = 800;
  if (w > h) {
      return { w: base, h: Math.round(base * (h / w)) };
  } else {
      return { w: Math.round(base * (w / h)), h: base };
  }
};

const CanvasStage: React.FC<CanvasStageProps> = ({ imageUrl, aspectRatio, onUpdate, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  
  // Tools
  const [tool, setTool] = useState<ToolType>('brush');
  const [mode, setMode] = useState<DrawMode>('mask');
  const [brushSize, setBrushSize] = useState(30);
  const [color, setColor] = useState('#000000'); // For Sketch mode
  
  // Dimensions
  const [dimensions, setDimensions] = useState({ w: 800, h: 800 });
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Initialize Mode based on Input and Aspect Ratio
  useEffect(() => {
    if (!imageUrl) {
      // Blank Canvas Mode
      const dims = getDimensionsFromRatio(aspectRatio);
      setDimensions(dims);
      setMode('sketch'); 
      setImageObj(null);
      setElements([]); // Clear elements when resetting blank canvas
    } else {
      // Image Upload Mode (Fixed ratio based on image)
      setMode('mask'); 
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        setImageObj(img);
      };
      setElements([]);
    }
  }, [imageUrl, aspectRatio]); // Re-run when imageUrl or aspectRatio changes

  // Render Logic
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear & Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // White background (important for transparent PNGs or blank canvas)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Original Image
    if (imageObj) {
      ctx.drawImage(imageObj, 0, 0, dimensions.w, dimensions.h);
    }

    // 3. Helper to draw elements
    const drawElement = (el: DrawingElement) => {
        ctx.beginPath();
        const isMask = el.isMask;
        
        // Style
        if (isMask) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; // Red-500 50%
            ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        } else {
            ctx.strokeStyle = el.color;
            ctx.fillStyle = el.color;
        }
        ctx.lineWidth = el.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (el.type === 'freehand') {
            if (el.points.length > 0) {
                ctx.moveTo(el.points[0].x, el.points[0].y);
                for (let i = 1; i < el.points.length; i++) {
                    ctx.lineTo(el.points[i].x, el.points[i].y);
                }
                ctx.stroke();
            }
        } else if (el.type === 'rect') {
             const w = el.end.x - el.start.x;
             const h = el.end.y - el.start.y;
             ctx.strokeRect(el.start.x, el.start.y, w, h);
        } else if (el.type === 'circle') {
             const radius = Math.sqrt(
                Math.pow(el.end.x - el.start.x, 2) + 
                Math.pow(el.end.y - el.start.y, 2)
             );
             ctx.beginPath();
             ctx.arc(el.start.x, el.start.y, radius, 0, 2 * Math.PI);
             ctx.stroke();
        }
    };

    // 4. Draw All Elements
    elements.forEach(drawElement);
    if (currentElement) drawElement(currentElement);

  }, [dimensions, imageObj, elements, currentElement]);

  // Trigger Render
  useEffect(() => {
    render();
  }, [render]);

  // Export Logic (Debounced)
  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Export Composite (Visual)
    const compositeUrl = canvas.toDataURL('image/png');

    // 2. Export Mask (if any mask elements exist)
    const maskElements = [...elements, ...(currentElement ? [currentElement] : [])].filter(e => e.isMask);
    
    let maskUrl: string | null = null;
    if (maskElements.length > 0) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = dimensions.w;
        offCanvas.height = dimensions.h;
        const ctx = offCanvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, dimensions.w, dimensions.h);
            
            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            maskElements.forEach(el => {
                ctx.lineWidth = el.size;
                ctx.beginPath();
                if (el.type === 'freehand') {
                    if (el.points.length > 0) {
                        ctx.moveTo(el.points[0].x, el.points[0].y);
                        for (let i = 1; i < el.points.length; i++) {
                            ctx.lineTo(el.points[i].x, el.points[i].y);
                        }
                        ctx.stroke();
                    }
                } else if (el.type === 'rect') {
                    const w = el.end.x - el.start.x;
                    const h = el.end.y - el.start.y;
                    ctx.strokeRect(el.start.x, el.start.y, w, h);
                } else if (el.type === 'circle') {
                     const radius = Math.sqrt(Math.pow(el.end.x - el.start.x, 2) + Math.pow(el.end.y - el.start.y, 2));
                     ctx.beginPath();
                     ctx.arc(el.start.x, el.start.y, radius, 0, 2 * Math.PI);
                     ctx.stroke();
                }
            });
            maskUrl = offCanvas.toDataURL('image/png');
        }
    }

    onUpdate(compositeUrl, maskUrl);

  }, [elements, currentElement, dimensions, onUpdate]);

  // Trigger export when drawing finishes
  useEffect(() => {
      if (!currentElement) {
          exportCanvas();
      }
  }, [currentElement, elements, exportCanvas]);

  // --- Event Handlers ---
  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive) return;
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;

    const isMask = mode === 'mask';
    const elColor = isMask ? 'red' : color;

    if (tool === 'brush' || tool === 'eraser') {
        const effectiveColor = tool === 'eraser' ? '#ffffff' : elColor;
        setCurrentElement({ type: 'freehand', points: [p], size: brushSize, color: effectiveColor, isMask });
    } else if (tool === 'rect' || tool === 'circle') {
        setCurrentElement({ type: tool, start: p, end: p, size: brushSize, color: elColor, isMask });
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!currentElement) return;
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;

    setCurrentElement(prev => {
        if (!prev) return null;
        if (prev.type === 'freehand') {
            return { ...prev, points: [...prev.points, p] };
        } else {
            return { ...prev, end: p }; // Update end point for shapes
        }
    });
  };

  const handleEnd = () => {
    if (currentElement) {
      setElements(prev => [...prev, currentElement]);
      setCurrentElement(null);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col" ref={containerRef}>
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded-xl flex flex-col gap-2 shadow-xl max-w-[90vw]">
        
        {/* Top Row: Tools */}
        <div className="flex items-center gap-2 justify-center">
            {/* Mode Switcher (Only if image exists) */}
            {imageUrl && (
                <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                    <button 
                        onClick={() => setMode('mask')}
                        className={`px-2 py-1 text-xs rounded-md font-bold ${mode === 'mask' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        遮罩
                    </button>
                    <button 
                        onClick={() => setMode('sketch')}
                        className={`px-2 py-1 text-xs rounded-md font-bold ${mode === 'sketch' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        绘画
                    </button>
                </div>
            )}

            <button onClick={() => setTool('brush')} title="画笔" className={`p-2 rounded-lg ${tool === 'brush' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Brush size={18}/></button>
            <button onClick={() => setTool('rect')} title="矩形" className={`p-2 rounded-lg ${tool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Square size={18}/></button>
            <button onClick={() => setTool('circle')} title="圆形" className={`p-2 rounded-lg ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Circle size={18}/></button>
             {mode === 'sketch' && (
                <button onClick={() => setTool('eraser')} title="橡皮擦" className={`p-2 rounded-lg ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Eraser size={18}/></button>
             )}
             <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <button onClick={() => { setElements([]); onUpdate(imageUrl || '', null); }} title="清除" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg"><RefreshCcw size={18}/></button>
            <button onClick={() => setElements(e => e.slice(0, -1))} title="撤销" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"><Undo size={18}/></button>
        </div>

        {/* Bottom Row: Settings */}
        <div className="flex items-center gap-3 justify-center pt-1 border-t border-slate-800">
             {/* Size Slider */}
             <input 
                type="range" min="5" max="100" 
                value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24 accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            
            {/* Color Picker (Only sketch mode) */}
            {mode === 'sketch' && (
                <div className="flex gap-1">
                    {COLORS.map(c => (
                        <button 
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-5 h-5 rounded-full border border-slate-600 ${color === c ? 'ring-2 ring-white scale-110' : ''}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-slate-950 rounded-lg border border-slate-800 relative cursor-crosshair touch-none select-none">
        <canvas
          ref={canvasRef}
          width={dimensions.w}
          height={dimensions.h}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="max-w-full max-h-full object-contain shadow-2xl"
          style={{ 
            maxWidth: '100%', 
            maxHeight: '600px',
            backgroundColor: '#ffffff' 
           }}
        />
      </div>
    </div>
  );
};

export default CanvasStage;