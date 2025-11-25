
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from './components/Editor';
import { AgentPanel } from './components/AgentPanel';
import { FloatingCommand } from './components/FloatingCommand';
import { Button } from './components/Button';
import { Message, SelectionState } from './types';
import { streamChatResponse, streamEditResponse, generateTitle } from './services/geminiService';
import { PanelRightClose, PanelRightOpen, FileText, Download, Command, FolderOpen } from 'lucide-react';

const INITIAL_CONTENT = `
# Welcome to DocuFlow

This is an agentic document editor. You can write just like you would in Word, but with an AI co-pilot built right in.

## How to use:
1. **Chat**: Open the sidebar to chat with your document. Ask for summaries, critiques, or brainstorming ideas.
2. **Agentic Write**: Ask the agent to "Rewrite this document" or "Add a paragraph about AI", and it will write directly in the editor.
3. **Inline Edit**: Select any text and press "Cmd + K" (or Ctrl + K) to instruct the AI to rewrite it.

Try asking the agent: "Remove all content and write a short story about a robot."
`;

export default function App() {
  const [content, setContent] = useState(INITIAL_CONTENT.trim());
  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAgentWriting, setIsAgentWriting] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Floating Command Bar State
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [commandBarPosition, setCommandBarPosition] = useState<{top: number, left: number} | null>(null);
  
  // Ref to track content during streaming updates for the replace protocol
  const contentRef = useRef(content);
  useEffect(() => { contentRef.current = content; }, [content]);

  // Initial Title Generation
  useEffect(() => {
     generateTitle(content).then(t => setDocTitle(t));
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (selection && selection.text) {
             setCommandBarPosition(null); 
             setIsCommandBarOpen(true);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
         e.preventDefault();
         fileInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        setContent(text);
        setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
        
        // Add a system message about the file load
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          content: `I've opened **${file.name}**. What would you like to do with it?`
        }]);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleDownload = () => {
    const filename = docTitle.trim() || "Untitled";
    // Add extension if missing
    const fullFilename = filename.match(/\.(md|txt|markdown)$/i) 
      ? filename 
      : `${filename}.md`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fullFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (text: string) => {
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, newUserMsg]);
    setIsStreaming(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'model', content: '', isStreaming: true }]);

    // Variables for replace protocol
    let replaceInsertionIndex = -1;
    // We use a local buffer to ensure atomic replacements don't get messed up by React state batching if too fast
    let currentProcessingContent = contentRef.current; 

    try {
      const stream = streamChatResponse([...messages, newUserMsg], contentRef.current);
      
      let fullChatContent = '';
      
      for await (const event of stream) {
        if (event.type === 'text') {
            fullChatContent += event.content;
            setMessages(prev => prev.map(m => 
              m.id === botMsgId ? { ...m, content: fullChatContent } : m
            ));
        } else if (event.type === 'doc_start') {
            setIsAgentWriting(true);
            setContent(""); 
            currentProcessingContent = "";
        } else if (event.type === 'doc_chunk') {
            setContent(prev => prev + event.content);
            currentProcessingContent += event.content;
        } else if (event.type === 'doc_end') {
            setIsAgentWriting(false);
            generateTitle(currentProcessingContent).then(t => setDocTitle(t));
        } else if (event.type === 'replace_start') {
            setIsAgentWriting(true);
            const searchIdx = currentProcessingContent.indexOf(event.search);
            
            if (searchIdx !== -1) {
                // Remove the searched text immediately to prepare for replacement
                const before = currentProcessingContent.substring(0, searchIdx);
                const after = currentProcessingContent.substring(searchIdx + event.search.length);
                
                // Update state and local tracking ref
                const newContent = before + after;
                setContent(newContent);
                currentProcessingContent = newContent;
                
                // Set insertion point
                replaceInsertionIndex = searchIdx;
            } else {
                console.warn("Could not find text to replace:", event.search);
                replaceInsertionIndex = -1; 
                fullChatContent += "\n\n*(I couldn't find the exact text to replace. I might have hallucinated the location.)*";
                setMessages(prev => prev.map(m => 
                  m.id === botMsgId ? { ...m, content: fullChatContent } : m
                ));
            }
        } else if (event.type === 'replace_chunk') {
            if (replaceInsertionIndex !== -1) {
                const chunk = event.content;
                const before = currentProcessingContent.substring(0, replaceInsertionIndex);
                const after = currentProcessingContent.substring(replaceInsertionIndex);
                
                const newContent = before + chunk + after;
                setContent(newContent);
                currentProcessingContent = newContent;
                
                // Move insertion index forward so next chunk appends correctly
                replaceInsertionIndex += chunk.length;
            }
        } else if (event.type === 'replace_end') {
            setIsAgentWriting(false);
            replaceInsertionIndex = -1;
        }
      }
    } catch (error) {
        console.error(error);
        setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, content: m.content + "\n[Error: Something went wrong]" } : m
        ));
    } finally {
        setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, isStreaming: false } : m
        ));
        setIsStreaming(false);
        setIsAgentWriting(false);
    }
  };

  const handleFloatingCommand = async (instruction: string) => {
    if (!selection) return;
    setIsCommandBarOpen(false);
    setIsStreaming(true);
    
    // Optimistic update - gray out selection or show loading?
    // For now we'll just stream the replacement
    
    let newText = '';
    const start = selection.start;
    const end = selection.end;
    
    try {
        const stream = streamEditResponse(content, instruction, selection.text);
        
        let firstChunk = true;
        
        for await (const chunk of stream) {
            if (firstChunk) {
                // On first chunk, clear the selection
                setContent(prev => prev.substring(0, start) + chunk + prev.substring(end));
                firstChunk = false;
            } else {
                // Append to the growing new text
                // We need to calculate where to insert based on how much we've already added
                setContent(prev => {
                     const before = prev.substring(0, start + newText.length);
                     const after = prev.substring(start + newText.length);
                     return before + chunk + after;
                });
            }
            newText += chunk;
        }
    } finally {
        setIsStreaming(false);
        setSelection(null); // Clear selection after edit
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".txt,.md,.markdown"
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 transition-all duration-300">
        
        {/* Top Header */}
        <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/20">
                D
             </div>
             <div className="flex flex-col">
                <input 
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-zinc-200 focus:outline-none focus:ring-0 placeholder-zinc-600 w-48 lg:w-64"
                  placeholder="Untitled Document"
                />
                <span className="text-[10px] text-zinc-500">
                   {isAgentWriting ? <span className="text-blue-400 animate-pulse">Agent is writing...</span> : 'Edited just now'}
                </span>
             </div>
          </div>

          <div className="flex items-center space-x-2">
             <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                title="Open File (Cmd+O)"
             >
                <FolderOpen className="w-4 h-4 text-zinc-400" />
             </Button>
             <Button variant="ghost" size="sm" onClick={handleDownload} title="Download File">
                <Download className="w-4 h-4 text-zinc-400" />
             </Button>
             <div className="w-px h-4 bg-zinc-800 mx-2" />
             <Button 
               variant="ghost" 
               size="sm" 
               className={isSidebarOpen ? "bg-zinc-800 text-zinc-200" : ""}
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             >
               {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
             </Button>
          </div>
        </header>

        {/* Editor Surface */}
        <div className="flex-1 relative overflow-hidden">
             <Editor 
                content={content} 
                onChange={setContent} 
                onSelectionChange={(start, end, text) => {
                    setSelection({ start, end, text });
                    // Calculate position for floating bar if needed, 
                    // usually we wait for shortcut, but could show tooltip
                }}
                isStreaming={isAgentWriting}
             />
             
             {/* Floating Hint */}
             {selection && selection.text && !isCommandBarOpen && (
                 <div className="absolute bottom-8 right-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-zinc-900 text-zinc-400 text-xs px-3 py-1.5 rounded-full border border-zinc-800 shadow-lg flex items-center gap-2">
                        <Command className="w-3 h-3" /> 
                        <span>+ K to edit</span>
                    </div>
                 </div>
             )}

             <FloatingCommand 
                isVisible={isCommandBarOpen}
                position={commandBarPosition}
                selectedText={selection?.text || ''}
                onClose={() => setIsCommandBarOpen(false)}
                onSubmit={handleFloatingCommand}
             />
        </div>
      </div>

      {/* Right Sidebar - Agent */}
      <div 
        className={`${
          isSidebarOpen ? 'w-[350px] translate-x-0' : 'w-0 translate-x-full opacity-0'
        } transition-all duration-300 ease-in-out border-l border-zinc-800 bg-zinc-900 flex flex-col shrink-0`}
      >
        <div className="w-[350px] h-full flex flex-col">
           <AgentPanel 
              messages={messages} 
              isStreaming={isStreaming} 
              onSendMessage={handleSendMessage}
              onStop={() => setIsStreaming(false)} // Basic stop implementation
           />
        </div>
      </div>
    </div>
  );
}
