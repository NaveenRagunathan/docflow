
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, StreamEvent } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const BASE_SYSTEM_INSTRUCTION = `You are DocuFlow, a friendly and intelligent writing co-pilot.
Your goal is to collaborate with the user to write, edit, and refine documents naturally.

TONE & PERSONA:
- Relaxed, professional, and helpful. 
- Don't be robotic. Use phrases like "Sure thing," "Here you go," or "I've tweaked that for you."
- Be concise. Don't over-explain unless asked.

CORE BEHAVIOR RULES:
1. **PREFER TARGETED EDITS**: When asked to change, fix, rewrite, or add to a specific part of the document, you **MUST** use the TARGETED EDIT protocol (Search & Replace).
   - **NEVER** rewrite the full document unless the user explicitly asks to "rewrite everything" or if the document is currently empty.
   - If the user asks to "make the second paragraph better", find that paragraph, SEARCH for it, and REPLACE it with the better version.

2. **SMART CONTEXT**: You have read the document. You know what's in it. Refer to it naturally.

PROTOCOLS:

A. **TARGETED EDIT (The Default)**:
   Use this for 95% of requests (fixing typos, rewriting sections, inserting text).
   
   Format:
   :::SEARCH:::
   [Exact text to find. Must match the user's document EXACTLY, including punctuation and whitespace.]
   :::REPLACE:::
   [The new text to replace it with.]
   :::END:::

   *Insertion Tip*: To insert new text, SEARCH for the sentence *immediately before* the insertion point, and in the REPLACE block, write that sentence followed by your new content.

B. **FULL DOCUMENT WRITE**:
   Use this ONLY when starting from scratch or when requested to "rewrite the whole document".
   
   Format:
   :::START_DOC:::
   [The complete document content]
   :::END_DOC:::
`;

export const streamChatResponse = async function* (
  messages: Message[],
  currentDocumentContent: string
): AsyncGenerator<StreamEvent, void, unknown> {
  const model = 'gemini-2.5-flash';

  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1];

  const contextPrompt = `
  [CURRENT DOCUMENT CONTENT START]
  ${currentDocumentContent}
  [CURRENT DOCUMENT CONTENT END]

  User Query: ${lastMessage.content}
  `;

  try {
    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction: BASE_SYSTEM_INSTRUCTION,
      },
      history: history,
    });

    const result = await chat.sendMessageStream({
      message: contextPrompt,
    });

    let buffer = '';
    
    // Tag Definitions
    const TAGS = {
      DOC_START: ':::START_DOC:::',
      DOC_END: ':::END_DOC:::',
      SEARCH_START: ':::SEARCH:::',
      REPLACE_START: ':::REPLACE:::',
      END_REPLACE: ':::END:::'
    };

    let mode: 'CHAT' | 'DOC_WRITE' | 'BUFFERING_SEARCH' | 'REPLACE_WRITE' = 'CHAT';

    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      const text = c.text || '';
      buffer += text;

      let processed = true;
      while (processed) {
        processed = false;

        if (mode === 'CHAT') {
          // Check for start tags
          const docStartIdx = buffer.indexOf(TAGS.DOC_START);
          const searchStartIdx = buffer.indexOf(TAGS.SEARCH_START);

          // Determine which tag comes first if both are present
          let foundDoc = docStartIdx !== -1;
          let foundSearch = searchStartIdx !== -1;
          
          if (foundDoc && foundSearch) {
             if (docStartIdx < searchStartIdx) foundSearch = false;
             else foundDoc = false;
          }

          if (foundDoc) {
            if (docStartIdx > 0) yield { type: 'text', content: buffer.substring(0, docStartIdx) };
            yield { type: 'doc_start' };
            buffer = buffer.substring(docStartIdx + TAGS.DOC_START.length);
            mode = 'DOC_WRITE';
            processed = true;
          } else if (foundSearch) {
            if (searchStartIdx > 0) yield { type: 'text', content: buffer.substring(0, searchStartIdx) };
            buffer = buffer.substring(searchStartIdx + TAGS.SEARCH_START.length);
            mode = 'BUFFERING_SEARCH';
            processed = true;
          } else {
             // Heuristic: don't yield if buffer ends with ':' which might be start of a tag
             if (!buffer.endsWith(':') && !buffer.endsWith(':::')) {
                yield { type: 'text', content: buffer };
                buffer = '';
             }
          }
        } 

        else if (mode === 'DOC_WRITE') {
          const endIdx = buffer.indexOf(TAGS.DOC_END);
          if (endIdx !== -1) {
            yield { type: 'doc_chunk', content: buffer.substring(0, endIdx) };
            yield { type: 'doc_end' };
            buffer = buffer.substring(endIdx + TAGS.DOC_END.length);
            mode = 'CHAT';
            processed = true;
          } else {
             if (!buffer.endsWith(':') && !buffer.endsWith(':::')) {
                yield { type: 'doc_chunk', content: buffer };
                buffer = '';
             }
          }
        }

        else if (mode === 'BUFFERING_SEARCH') {
          const replaceStartIdx = buffer.indexOf(TAGS.REPLACE_START);
          if (replaceStartIdx !== -1) {
            const searchContent = buffer.substring(0, replaceStartIdx).trim();
            yield { type: 'replace_start', search: searchContent };
            buffer = buffer.substring(replaceStartIdx + TAGS.REPLACE_START.length);
            mode = 'REPLACE_WRITE';
            processed = true;
          }
          // Wait for more data to complete the search block
        }

        else if (mode === 'REPLACE_WRITE') {
          const endIdx = buffer.indexOf(TAGS.END_REPLACE);
          if (endIdx !== -1) {
             const content = buffer.substring(0, endIdx);
             yield { type: 'replace_chunk', content: content };
             yield { type: 'replace_end' };
             buffer = buffer.substring(endIdx + TAGS.END_REPLACE.length);
             mode = 'CHAT';
             processed = true;
          } else {
             if (!buffer.endsWith(':') && !buffer.endsWith(':::')) {
                yield { type: 'replace_chunk', content: buffer };
                buffer = '';
             }
          }
        }
      }
    }
  } catch (error) {
    console.error("Stream error:", error);
    yield { type: 'text', content: "\n[Error generating response]" };
  }
};

export const streamEditResponse = async function* (
  content: string,
  instruction: string,
  selection: string
): AsyncGenerator<string, void, unknown> {
  const model = 'gemini-2.5-flash';
  
  const prompt = `
    You are an AI editor.
    
    Instruction: ${instruction}
    
    Selected Text to Replace:
    "${selection}"
    
    Full Document Context:
    ${content}
    
    Output ONLY the replacement text for the "Selected Text". Do not include quotes or explanation.
  `;

  const chat = ai.chats.create({
    model,
  });

  const result = await chat.sendMessageStream({ message: prompt });
  
  for await (const chunk of result) {
    const c = chunk as GenerateContentResponse;
    if (c.text) yield c.text;
  }
};

export const generateTitle = async (content: string): Promise<string> => {
  if (!content.trim()) return "Untitled Document";
  const model = 'gemini-2.5-flash';
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Generate a very short, specific title (max 5 words) for this document:\n\n${content.substring(0, 500)}...`,
    });
    return response.text?.trim().replace(/^["']|["']$/g, '') || "Untitled Document";
  } catch (e) {
    return "Untitled Document";
  }
};
