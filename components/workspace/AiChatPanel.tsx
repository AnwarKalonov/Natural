import React from 'react';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface AiChatPanelProps {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ messages, input, loading, onInputChange, onSend }) => {
  return (
    <section className="rounded-xl border border-[#2b3035] bg-[#111316] p-3 shadow-sm">
      <div className="text-sm font-semibold text-[#e6edf3] mb-1">AI Chat</div>
      <div className="text-[11px] text-[#8d96a0] mb-2">Fast workspace chat with file context.</div>

      <div className="h-44 overflow-auto rounded-md border border-[#2b3035] bg-[#0b0d0f] p-2 space-y-2">
        {messages.length === 0 && <div className="text-[11px] text-[#7a838d]">Ask anything about this project.</div>}
        {messages.map((msg, idx) => (
          <div key={idx} className={`text-xs leading-relaxed ${msg.role === 'user' ? 'text-[#9dc4ff]' : 'text-[#d8dde3]'}`}>
            <span className="font-semibold mr-1">{msg.role === 'user' ? 'You:' : 'AI:'}</span>
            <span className="whitespace-pre-wrap">{msg.text}</span>
          </div>
        ))}
        {loading && <div className="text-[11px] text-[#8d96a0]">AI is thinking…</div>}
      </div>

      <div className="mt-2 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask AI to explain, modify, or plan next steps"
          className="flex-1 h-16 rounded-md border border-[#2b3035] bg-[#0b0d0f] px-2 py-1.5 text-xs text-[#e6edf3] placeholder-[#6f7782] outline-none focus:border-[#3b82f6]"
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="h-16 w-20 rounded-md bg-[#2563eb] text-white text-xs font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
};
