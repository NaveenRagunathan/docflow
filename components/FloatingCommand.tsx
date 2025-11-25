import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';

interface FloatingCommandProps {
  isVisible: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onSubmit: (instruction: string) => void;
  selectedText: string;
}

export const FloatingCommand: React.FC<FloatingCommandProps> = ({
  isVisible,
  position,
  onClose,
  onSubmit,
  selectedText
}) => {
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (instruction.trim()) {
      onSubmit(instruction);
      setInstruction('');
    }
  };

  if (!isVisible) return null;

  // If no position provided, center it (fallback)
  const style = position 
    ? { top: position.top - 60, left: position.left } 
    : { top: '20%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div 
        className="fixed z-50 animate-in fade-in zoom-in duration-200"
        style={style}
    >
      <div className="w-[400px] bg-zinc-900 rounded-xl shadow-2xl border border-zinc-700 overflow-hidden ring-1 ring-black/50">
        <form onSubmit={handleSubmit} className="relative flex items-center p-1">
          <div className="flex items-center justify-center w-8 h-8 text-blue-400 ml-1">
            <Sparkles className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-zinc-100 text-sm px-2 py-3 focus:outline-none placeholder-zinc-500"
            placeholder="Edit selection..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <div className="flex items-center space-x-1 pr-2">
             <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
             >
                <X className="w-3 h-3" />
             </button>
             <button
                type="submit"
                className="p-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
             >
                <ArrowRight className="w-3 h-3" />
             </button>
          </div>
        </form>
        {selectedText && (
          <div className="px-4 py-2 bg-zinc-950/50 border-t border-zinc-800 text-xs text-zinc-500 truncate max-w-full">
            Selected: <span className="italic">"{selectedText.substring(0, 45)}{selectedText.length > 45 ? '...' : ''}"</span>
          </div>
        )}
      </div>
    </div>
  );
};