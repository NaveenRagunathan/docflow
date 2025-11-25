import React, { useRef, useEffect } from 'react';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onSelectionChange: (start: number, end: number, text: string) => void;
  isStreaming: boolean;
}

export const Editor: React.FC<EditorProps> = ({ 
  content, 
  onChange, 
  onSelectionChange,
  isStreaming 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  const handleSelect = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = content.substring(start, end);
      onSelectionChange(start, end, text);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-100 relative h-full flex justify-center p-8 md:p-12 cursor-text" onClick={() => textareaRef.current?.focus()}>
      {/* Paper Container */}
      <div className={`w-full max-w-[850px] bg-white min-h-[1100px] shadow-lg text-zinc-900 transition-all duration-300 ease-in-out ${isStreaming ? 'ring-2 ring-blue-400/50' : ''}`}>
        {/* Simulating Page Margins */}
        <div className="p-[1in] min-h-full">
           <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onSelect={handleSelect}
            onKeyUp={handleSelect}
            onMouseUp={handleSelect}
            className={`w-full h-full resize-none border-none outline-none font-serif text-lg leading-relaxed bg-transparent placeholder-zinc-300 transition-opacity duration-200 ${isStreaming ? 'opacity-90' : 'opacity-100'}`}
            placeholder="Start writing..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};