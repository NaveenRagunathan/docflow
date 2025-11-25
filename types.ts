
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
}

export interface DocumentState {
  id: string;
  title: string;
  content: string;
  lastModified: Date;
}

export type AgentMode = 'chat' | 'edit';

export interface SelectionState {
  start: number;
  end: number;
  text: string;
}

export type StreamEvent = 
  | { type: 'text'; content: string }
  | { type: 'doc_start' }
  | { type: 'doc_chunk'; content: string }
  | { type: 'doc_end' }
  | { type: 'replace_start'; search: string }
  | { type: 'replace_chunk'; content: string }
  | { type: 'replace_end' };

export interface StreamChunk {
  text: string;
}
