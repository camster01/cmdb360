import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { useApp } from '../../context/AppContext';
import { streamChat } from '../../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatModal() {
  const { setModalChat } = useApp();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);
    setStreamingText('');
    setError('');

    let accumulated = '';
    try {
      await streamChat(newMessages, chunk => {
        accumulated += chunk;
        setStreamingText(accumulated);
      });
      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setStreamingText('');
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Modal title="CMDB360 Chatbot" onClose={() => setModalChat(false)} width="max-w-2xl">
      {/* Message history */}
      <div className="h-96 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.length === 0 && !streaming && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm italic">
            Ask anything about the knowledgebase…
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-800 whitespace-pre-wrap">
              {streamingText || (
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          </div>
        )}

        {error && <div className="text-red-600 text-xs text-center">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          placeholder="Ask anything… (Enter to send)"
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
        />
        <button
          onClick={handleSend}
          disabled={streaming || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm px-4 py-1.5 rounded transition-colors"
        >
          Send
        </button>
      </div>
    </Modal>
  );
}
