/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  MessageSquare, 
  Send, 
  RefreshCw,
  Image as ImageIcon,
  ShoppingBag,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';

// --- Types ---

type Style = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  previewColor: string;
};

type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

const STYLES: Style[] = [
  { id: 'scandinavian', name: 'Escandinavo', description: 'Minimalista, funcional y acogedor con maderas claras.', prompt: 'Transforma esta habitación en un interior luminoso de estilo escandinavo. Usa muebles de madera clara, tonos neutros (blancos, grises), textiles acogedores y decoración minimalista. Mantén la distribución estructural básica.', previewColor: 'bg-slate-100' },
  { id: 'mid-century', name: 'Moderno de Mediados de Siglo', description: 'Vibras retro con formas orgánicas y detalles en madera.', prompt: 'Transforma esta habitación en un interior de estilo Moderno de Mediados de Siglo. Usa muebles icónicos de patas cónicas, tonos de madera cálidos, toques de amarillo mostaza o verde azulado, y patrones geométricos. Mantén la distribución estructural básica.', previewColor: 'bg-amber-100' },
  { id: 'industrial', name: 'Industrial', description: 'Materiales crudos como ladrillo, metal y madera expuesta.', prompt: 'Transforma esta habitación en un interior de estilo Industrial. Usa detalles en metal oscuro, texturas de ladrillo expuesto, muebles de cuero e iluminación con bombillas Edison. Mantén la distribución estructural básica.', previewColor: 'bg-zinc-300' },
  { id: 'bohemian', name: 'Bohemio', description: 'Ecléctico, colorido y lleno de texturas naturales.', prompt: 'Transforma esta habitación en un interior de estilo Bohemio. Usa colores vibrantes, alfombras superpuestas, muchas plantas de interior, arte de pared en macramé y muebles de ratán. Mantén la distribución estructural básica.', previewColor: 'bg-orange-100' },
  { id: 'modern-luxury', name: 'Lujo Moderno', description: 'Elegante, sofisticado y con materiales de alta gama.', prompt: 'Transforma esta habitación en un interior de estilo Lujo Moderno. Usa superficies de mármol, detalles en oro o latón, tapicería de terciopelo e iluminación sofisticada. Mantén la distribución estructural básica.', previewColor: 'bg-indigo-50' },
];

// --- Components ---

const CompareSlider = ({ original, reimagined }: { original: string; reimagined: string }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, position)));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize select-none border border-black/5 shadow-xl"
      onMouseMove={(e) => e.buttons === 1 && handleMove(e)}
      onMouseDown={handleMove}
      onTouchMove={handleMove}
    >
      {/* Reimagined (Background) */}
      <img 
        src={reimagined} 
        alt="Reimagined space" 
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
      
      {/* Original (Foreground with Clip) */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img 
          src={original} 
          alt="Original space" 
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.3)] z-10"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-black/10">
          <div className="flex gap-0.5">
            <ChevronLeft className="w-3 h-3 text-zinc-600" />
            <ChevronRight className="w-3 h-3 text-zinc-600" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-medium pointer-events-none">
        Original
      </div>
      <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-medium pointer-events-none">
        Rediseñado
      </div>
    </div>
  );
};

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [reimaginedImage, setReimaginedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<Style>(STYLES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // Initialize chat session when original image is uploaded
  useEffect(() => {
    if (originalImage && !chatSessionRef.current) {
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction: "Eres un experto Consultor de Diseño de Interiores de IA. Ayuda a los usuarios a refinar los diseños de sus habitaciones. Cuando pidan cambios, sugiere cómo se vería. Si piden artículos, proporciona descripciones estilo tienda y enlaces (usa enlaces de ejemplo como 'https://www.ikea.com' o 'https://www.westelm.com'). Sé alentador y profesional. Tienes acceso al contexto de la foto de la habitación subida por el usuario. Responde siempre en español."
        }
      });
    }
    if (!originalImage) {
      chatSessionRef.current = null;
    }
  }, [originalImage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target?.result as string);
        setReimaginedImage(null);
        setChatMessages([]);
        chatSessionRef.current = null; // Reset chat session
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDownload = () => {
    if (!reimaginedImage) return;
    const link = document.createElement('a');
    link.href = reimaginedImage;
    link.download = `aura-design-${selectedStyle.id}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateReimagined = async (style: Style = selectedStyle, refinementPrompt?: string) => {
    if (!originalImage) return;
    setIsGenerating(true);
    
    try {
      const base64Data = originalImage.split(',')[1];
      const prompt = refinementPrompt 
        ? `Basado en el diseño anterior, ${refinementPrompt}. Mantén la estructura principal de la habitación de la foto original.`
        : style.prompt;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: prompt }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setReimaginedImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !originalImage || !chatSessionRef.current) return;

    const userMsg = inputMessage;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputMessage('');
    setIsChatting(true);

    try {
      // If the user is asking for a design change, we might want to trigger a re-generation
      const isDesignChange = /change|make|add|remove|keep|color|style|rug|furniture|wall|reimagine/i.test(userMsg);

      const response = await chatSessionRef.current.sendMessage({ message: userMsg });
      const modelText = response.text || "Lo siento, no pude procesar eso.";
      setChatMessages(prev => [...prev, { role: 'model', text: modelText }]);

      if (isDesignChange) {
        // Trigger a re-gen with the user's refinement
        generateReimagined(selectedStyle, userMsg);
      }
    } catch (error) {
      console.error("Chat failed:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Encontré un error. Por favor, inténtalo de nuevo." }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-zinc-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Aura Interior AI</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Consultor de Diseño</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-zinc-600 hover:text-indigo-600 transition-colors">Galería</a>
            <a href="#" className="text-sm font-medium text-zinc-600 hover:text-indigo-600 transition-colors">Precios</a>
            <button className="px-5 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-all shadow-md">
              Empezar
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Visualization */}
        <div className="lg:col-span-7 space-y-8">
          {!originalImage ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={triggerUpload}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="aspect-[4/3] w-full border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center p-12 text-center bg-white group hover:border-indigo-300 transition-colors cursor-pointer relative"
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                onChange={handleUpload}
                className="hidden"
              />
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Sube tu espacio</h2>
              <p className="text-zinc-500 max-w-xs mx-auto">
                Toma una foto de tu habitación y deja que nuestra IA imagine las posibilidades.
              </p>
              <div className="mt-8 flex gap-2">
                <span className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sala</span>
                <span className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500">Dormitorio</span>
                <span className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500">Oficina</span>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <div className="relative">
                {reimaginedImage ? (
                  <CompareSlider original={originalImage} reimagined={reimaginedImage} />
                ) : (
                  <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-black/5 shadow-2xl">
                    <img src={originalImage} alt="Original" className="w-full h-full object-cover" />
                    {isGenerating && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                        <RefreshCw className="w-12 h-12 animate-spin mb-4" />
                        <p className="text-lg font-medium">Rediseñando tu espacio...</p>
                        <p className="text-sm opacity-70">Aplicando estilo {selectedStyle.name}</p>
                      </div>
                    )}
                    {!isGenerating && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button 
                          onClick={() => generateReimagined()}
                          className="px-8 py-4 bg-white text-zinc-900 rounded-full font-bold shadow-2xl hover:scale-105 transition-transform flex items-center gap-3"
                        >
                          <Sparkles className="w-5 h-5 text-indigo-600" />
                          Generar Diseño
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                <button 
                  onClick={() => { setOriginalImage(null); setReimaginedImage(null); }}
                  className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-zinc-50 transition-colors border border-black/5"
                >
                  <RefreshCw className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Style Carousel */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Seleccionar Estilo</h3>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-200"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-200"></div>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        setSelectedStyle(style);
                        if (reimaginedImage) generateReimagined(style);
                      }}
                      className={cn(
                        "flex-shrink-0 w-48 p-4 rounded-2xl border transition-all text-left group",
                        selectedStyle.id === style.id 
                          ? "border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50" 
                          : "border-black/5 bg-white hover:border-zinc-300"
                      )}
                    >
                      <div className={cn("w-full h-24 rounded-xl mb-3", style.previewColor)}></div>
                      <h4 className="font-bold text-sm mb-1">{style.name}</h4>
                      <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                        {style.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Chat & Consultation */}
        <div className="lg:col-span-5 flex flex-col h-[700px] bg-white rounded-3xl border border-black/5 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-black/5 flex items-center justify-between bg-zinc-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-black/5">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Asistente de Diseño</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-medium text-zinc-500">En línea y listo</span>
                </div>
              </div>
            </div>
            <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <Info className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 px-8">
                <div className="p-4 bg-zinc-100 rounded-full">
                  <ImageIcon className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-sm font-medium">
                  {originalImage 
                    ? "Pídeme que refine el diseño o busque muebles similares." 
                    : "Sube una foto para comenzar tu consulta de diseño."}
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div 
                    className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-zinc-900 text-white rounded-tr-none" 
                        : "bg-zinc-100 text-zinc-800 rounded-tl-none"
                    )}
                  >
                    <div className="markdown-body">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 px-1">
                    {msg.role === 'user' ? 'Tú' : 'Aura AI'}
                  </span>
                </div>
              ))
            )}
            {isChatting && (
              <div className="flex items-center gap-2 text-zinc-400">
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"></span>
                </div>
                <span className="text-[10px] font-medium">El asistente está pensando...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-6 bg-zinc-50/50 border-t border-black/5">
            <div className="relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={originalImage ? "Prueba con 'Haz la alfombra azul' o 'Encuentra esta silla'..." : "Sube una foto primero..."}
                disabled={!originalImage || isChatting}
                className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none min-h-[56px] max-h-32"
                rows={1}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isChatting || !originalImage}
                className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-4 flex items-center gap-4">
              <button className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 hover:text-indigo-600 transition-colors">
                <ShoppingBag className="w-3.5 h-3.5" />
                COMPRAR ARTÍCULOS
              </button>
              <div className="h-3 w-[1px] bg-zinc-200"></div>
              <button 
                onClick={handleDownload}
                disabled={!reimaginedImage}
                className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:hover:text-zinc-400"
              >
                <Upload className="w-3.5 h-3.5 rotate-180" />
                BAJAR DISEÑO
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-black/5 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <Sparkles className="w-5 h-5" />
            <span className="font-bold text-sm tracking-tighter">AURA INTERIOR AI</span>
          </div>
          <p className="text-sm text-zinc-400 max-w-md">
            Transformando espacios con inteligencia artificial. Aura AI te ayuda a visualizar la casa de tus sueños en segundos.
          </p>
          <div className="flex gap-8 text-xs font-medium text-zinc-500">
            <a href="#" className="hover:text-zinc-900 transition-colors">Política de Privacidad</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Términos de Servicio</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Soporte</a>
          </div>
          <p className="text-[10px] text-zinc-300 mt-4">
            &copy; 2026 Aura Interior AI. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
