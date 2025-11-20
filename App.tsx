import React, { useState, useCallback } from 'react';
import { Upload, Image as ImageIcon, Sparkles, X, Plus, Wand2, Loader2, FilePlus, Settings, Key } from 'lucide-react';
import { ImageSession } from './types';
import CanvasStage from './components/CanvasStage';
import { generateEditedImages } from './services/geminiService';

const STYLE_PRESETS = [
  { label: '赛博朋克', prompt: 'Cyberpunk style, neon lights, futuristic city vibe, high contrast, vivid colors.' },
  { label: '水彩', prompt: 'Soft watercolor painting style, artistic, fluid strokes, pastel colors.' },
  { label: '素描', prompt: 'Pencil sketch style, black and white, detailed lines, rough texture.' },
  { label: '写实', prompt: 'Photorealistic, 8k resolution, high detail, cinematic lighting.' },
  { label: '卡通', prompt: 'Vibrant cartoon style, bold outlines, flat colors, fun character design.' },
];

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', w: 'w-4', h: 'h-4' },
  { label: '4:3', value: '4:3', w: 'w-5', h: 'h-4' },
  { label: '3:4', value: '3:4', w: 'w-4', h: 'h-5' },
  { label: '16:9', value: '16:9', w: 'w-6', h: 'h-3.5' },
  { label: '9:16', value: '9:16', w: 'w-3.5', h: 'h-6' },
];

// Helper to calculate dimensions for the virtual canvas (high res)
const getGenerationDimensions = (ratio: string) => {
  const [w, h] = ratio.split(':').map(Number);
  const base = 1024; 
  if (w > h) {
      return { w: base, h: Math.round(base * (h / w)) };
  } else {
      return { w: Math.round(base * (w / h)), h: base };
  }
};

// Helper to create a blank white image Data URL
const createBlankCanvasDataUrl = (ratio: string): string => {
  const { w, h } = getGenerationDimensions(ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
  }
  return canvas.toDataURL('image/png');
};

export default function App() {
  // State
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // API Key State - safely access process.env
  const [apiKey, setApiKey] = useState(() => {
    try {
      return typeof process !== 'undefined' ? process.env.API_KEY || '' : '';
    } catch {
      return '';
    }
  });
  const [showSettings, setShowSettings] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newSessions: ImageSession[] = files.map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        originalUrl: URL.createObjectURL(file),
        maskUrl: null,
        compositeUrl: null,
        isDirty: false
      }));

      setSessions(prev => [...prev, ...newSessions]);
      if (!activeSessionId && newSessions.length > 0) {
        setActiveSessionId(newSessions[0].id);
      }
      setGeneratedImages([]);
      setError(null);
    }
  };

  const createBlankCanvas = () => {
    const newSession: ImageSession = {
        id: Math.random().toString(36).substring(7),
        file: null,
        originalUrl: null, // Indicates blank canvas
        maskUrl: null,
        compositeUrl: null,
        isDirty: false
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
    setGeneratedImages([]);
    setError(null);
  };

  const removeSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const updateSessionData = useCallback((compositeUrl: string, maskUrl: string | null) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { ...s, compositeUrl, maskUrl, isDirty: true } : s
    ));
  }, [activeSessionId]);

  const handleGenerate = async () => {
    if (!apiKey) {
        setShowSettings(true);
        setError("缺少 API 密钥。请在设置中配置。");
        return;
    }
    
    if (!prompt.trim()) {
        setError("请输入描述。");
        return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);

    try {
      let sessionToUse = sessions;
      
      // Pure Text-to-Image logic:
      // If the user hasn't created any sessions (uploaded or blank canvas),
      // we automatically create a temporary virtual session with a blank white image 
      // matching the selected Aspect Ratio. This forces the model to output the correct size.
      if (sessionToUse.length === 0) {
        const blankUrl = createBlankCanvasDataUrl(aspectRatio);
        sessionToUse = [{
            id: 'temp-generation-session',
            file: null,
            originalUrl: blankUrl, 
            maskUrl: null,
            compositeUrl: blankUrl,
            isDirty: false
        }];
      }

      const results = await generateEditedImages(sessionToUse, prompt, apiKey);
      setGeneratedImages(results);
    } catch (err: any) {
      setError(err.message || "生成图片失败。请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const addStyle = (stylePrompt: string) => {
      setPrompt(prev => {
          const sep = prev.trim() ? ' ' : '';
          return prev + sep + stylePrompt;
      });
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur fixed w-full z-50 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
             <Wand2 className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">NanoEdit</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Gemini 2.5 Flash Image</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-indigo-400 transition-colors"
                title="API Key Settings"
            >
                <Settings size={20} />
            </button>
        </div>
      </header>

      {/* API Key Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-md">
                <div className="flex items-center gap-2 mb-4 text-indigo-400">
                    <Key size={20} />
                    <h2 className="font-bold text-lg">配置 API 密钥</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                    您需要 Google Gemini API 密钥才能使用此应用。您可以从 <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-400 hover:underline">Google AI Studio</a> 获取。
                </p>
                <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="在此粘贴 AIza... 密钥"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none mb-4"
                />
                <div className="flex justify-end">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium"
                    >
                        保存并关闭
                    </button>
                </div>
            </div>
        </div>
      )}

      <main className="pt-20 pb-32 px-4 md:px-8 max-w-7xl mx-auto h-screen flex flex-col md:flex-row gap-6">
        
        {/* Left Column: Editor Stage */}
        <div className="flex-1 flex flex-col min-h-0 gap-4">
          <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
            
            {sessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-6 p-10 text-center border-2 border-dashed border-slate-800 m-4 rounded-xl">
                <div className="flex gap-4">
                    <div className="bg-slate-900 p-4 rounded-2xl">
                        <ImageIcon size={40} className="opacity-50" />
                    </div>
                    <div className="bg-slate-900 p-4 rounded-2xl">
                         <FilePlus size={40} className="opacity-50" />
                    </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-300">开始创作</h3>
                  <p className="max-w-xs mt-2 text-sm">上传照片编辑，使用空白画布绘图，或者直接在右侧输入提示词生成图片。</p>
                </div>
                <div className="flex gap-4 flex-wrap justify-center">
                    <label className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg cursor-pointer transition-all flex items-center gap-2 border border-slate-700">
                    <Upload size={18} />
                    <span>上传图片</span>
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileUpload} 
                    />
                    </label>
                    <button 
                        onClick={createBlankCanvas}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-500/25 flex items-center gap-2"
                    >
                        <FilePlus size={18} />
                        <span>空白画布</span>
                    </button>
                </div>
              </div>
            ) : (
              <>
               {/* Editor */}
                <div className="flex-1 relative p-4 flex items-center justify-center bg-[#1e1e1e]">
                    {activeSession ? (
                        <CanvasStage 
                            key={activeSession.id} 
                            imageUrl={activeSession.originalUrl} 
                            aspectRatio={aspectRatio}
                            onUpdate={updateSessionData}
                            isActive={true}
                        />
                    ) : (
                        <p className="text-slate-500">选择画布</p>
                    )}
                </div>

                {/* Thumbnails Bar */}
                <div className="h-24 bg-slate-900 border-t border-slate-800 p-3 flex gap-3 overflow-x-auto items-center">
                    {sessions.map(session => (
                        <div 
                            key={session.id} 
                            onClick={() => setActiveSessionId(session.id)}
                            className={`relative flex-shrink-0 h-full aspect-square rounded-md overflow-hidden border-2 cursor-pointer transition-all group bg-white ${
                                activeSessionId === session.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:border-slate-500'
                            }`}
                        >
                            <img 
                                src={session.compositeUrl || session.originalUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} 
                                alt="缩略图" 
                                className="w-full h-full object-contain bg-white" 
                            />
                            {session.originalUrl === null && <div className="absolute inset-0 flex items-center justify-center text-slate-900/20 font-bold text-xs">空</div>}
                            
                            <button 
                                onClick={(e) => removeSession(e, session.id)}
                                className="absolute top-0 right-0 bg-black/50 p-0.5 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    <div className="flex flex-col gap-1">
                        <label className="flex-1 aspect-square rounded-md border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800 flex items-center justify-center cursor-pointer text-slate-500 hover:text-slate-300 transition-colors" title="上传">
                            <Plus size={16} />
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <button onClick={createBlankCanvas} className="flex-1 aspect-square rounded-md border border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800 flex items-center justify-center cursor-pointer text-slate-500 hover:text-indigo-400 transition-colors" title="新建画布">
                            <FilePlus size={16} />
                        </button>
                    </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Controls & Output */}
        <div className="w-full md:w-96 flex flex-col gap-6 h-auto md:h-full overflow-y-auto pb-20">
          
          {/* Prompt Input */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-indigo-400 font-medium">
                <Sparkles size={18} />
                <h2>AI 指令</h2>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-slate-400 mb-2">描述您想要的图像</label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={activeSession?.originalUrl ? "例如：把衬衫改成红色的..." : "例如：一座拥有飞行汽车的未来城市..."}
                        className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none placeholder:text-slate-600"
                    />
                </div>
                
                {/* Style Presets */}
                <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">添加风格</label>
                    <div className="flex flex-wrap gap-2">
                        {STYLE_PRESETS.map(style => (
                            <button
                                key={style.label}
                                onClick={() => addStyle(style.prompt)}
                                className="px-3 py-1 bg-slate-900 hover:bg-indigo-900/30 border border-slate-700 hover:border-indigo-500/50 rounded-full text-xs text-slate-300 transition-colors"
                            >
                                + {style.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Aspect Ratio Selection */}
                <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">图片比例</label>
                    <div className="flex flex-wrap gap-2">
                        {ASPECT_RATIOS.map(ratio => (
                            <button 
                                key={ratio.value}
                                onClick={() => setAspectRatio(ratio.value)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                                    aspectRatio === ratio.value 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                }`}
                            >
                                <div className={`border-2 border-current rounded-sm ${ratio.w} ${ratio.h}`} />
                                <span className="text-xs font-medium">{ratio.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                        isGenerating || !prompt.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:border-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98]'
                    }`}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            处理中...
                        </>
                    ) : (
                        <>
                            <Wand2 size={18} />
                            生成
                        </>
                    )}
                </button>
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs break-words">
                        {error}
                    </div>
                )}
            </div>
          </div>

          {/* Output Section */}
          {generatedImages.length > 0 && (
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center justify-between mb-4">
                    <h2 className="text-indigo-400 font-medium flex items-center gap-2">
                        <ImageIcon size={18} />
                        结果
                    </h2>
                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded-full">{generatedImages.length} 已生成</span>
                </div>
                <div className="grid gap-4">
                    {generatedImages.map((url, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-slate-700 group relative">
                            <img src={url} alt={`Generated ${idx}`} className="w-full h-auto" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                                <a 
                                    href={url} 
                                    download={`nano-edit-${Date.now()}.png`}
                                    className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-indigo-50 transition-colors"
                                >
                                    下载
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}