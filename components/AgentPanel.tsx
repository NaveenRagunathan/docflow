import React, { useRef, useEffect, useState } from 'react';
import { Send, Sparkles, Bot, User, StopCircle } from 'lucide-react';
import { Message } from '../types';
import { Button } from './Button';

interface AgentPanelProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onStop: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ 
  messages, 
  isStreaming, 
  onSendMessage,
  onStop
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 w-[350px] shrink-0 shadow-2xl z-20">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <Sparkles className="w-4 h-4 text-blue-400 mr-2" />
        <span className="font-semibold text-sm text-zinc-200">AI Assistant</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2">
            <Bot className="w-8 h-8 opacity-20" />
            <p className="text-sm text-center">Ask me anything about your document.<br/>I can help rewrite, summarize, or brainstorm.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-center space-x-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-zinc-700' : 'bg-blue-600'}`}>
                {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
              </div>
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{msg.role === 'user' ? 'You' : 'Agent'}</span>
            </div>
            <div 
              className={`p-3 rounded-lg text-sm leading-relaxed max-w-[90%] whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-zinc-800 text-zinc-100 rounded-tr-none' 
                  : 'bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-tl-none'
              }`}
            >
              {msg.content}
              {msg.isStreaming && <span className="inline-block w-1.5 h-3 ml-1 bg-blue-400 animate-pulse"/>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-[80px] scrollbar-hide"
          />
          <div className="absolute right-2 bottom-2">
             {isStreaming ? (
                 <Button variant="ghost" size="sm" onClick={onStop} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                    <StopCircle className="w-4 h-4" />
                 </Button>
             ) : (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSubmit()} 
                    disabled={!input.trim()}
                    className={input.trim() ? "text-blue-400 hover:text-blue-300" : "text-zinc-600"}
                >
                    <Send className="w-4 h-4" />
                </Button>
             )}
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 mt-2 text-center">
            Agent reads your full document context.
        </p>
      </div>
    </div>
  );
};