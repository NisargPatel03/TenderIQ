import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { MessagesSquare, Send, Bot, User, HelpCircle } from 'lucide-react';

interface ChatMessage {
  id?: string;
  question: string;
  answer: string;
  created_at?: string;
}

interface ChatBotProps {
  tenderId: string;
  documentText: string;
  userId: string;
}

const renderMarkdown = (text: string) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  let inList = false;
  const listItems: React.ReactNode[] = [];
  const renderedElements: React.ReactNode[] = [];

  const parseLineContent = (lineText: string, key: string) => {
    const parts = lineText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${key}-${index}`} style={{ color: '#ffffff', fontWeight: '700' }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const isBullet = /^[*-]\s+/.test(trimmed);
    
    if (isBullet) {
      const content = trimmed.replace(/^[*-]\s+/, "");
      listItems.push(
        <li key={`li-${index}`} style={{ marginBottom: '6px', marginLeft: '16px', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
          {parseLineContent(content, `li-content-${index}`)}
        </li>
      );
      inList = true;
    } else {
      if (inList && listItems.length > 0) {
        renderedElements.push(
          <ul key={`ul-${index}`} style={{ margin: '8px 0', paddingLeft: '10px' }}>
            {[...listItems]}
          </ul>
        );
        listItems.length = 0;
        inList = false;
      }

      if (trimmed === '') {
        renderedElements.push(<div key={`br-${index}`} style={{ height: '8px' }} />);
      } else {
        renderedElements.push(
          <p key={`p-${index}`} style={{ margin: '6px 0', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
            {parseLineContent(line, `p-content-${index}`)}
          </p>
        );
      }
    }
  });

  if (inList && listItems.length > 0) {
    renderedElements.push(
      <ul key="ul-final" style={{ margin: '8px 0', paddingLeft: '10px' }}>
        {[...listItems]}
      </ul>
    );
  }

  return <div>{renderedElements}</div>;
};

export const ChatBot: React.FC<ChatBotProps> = ({ 
  tenderId, 
  documentText, 
  userId 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Q&A history from Supabase on load/tender change
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('tender_qa')
          .select('id, question, answer, created_at')
          .eq('tender_id', tenderId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error("Error loading chat history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [tenderId]);

  // 2. Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuestion = input.trim();
    setInput('');
    setLoading(true);

    // Format chat history for Gemini (max last 5 turns to save context space)
    const historyContext = messages.slice(-5).map((m) => ({
      question: m.question,
      answer: m.answer,
    }));

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_text: documentText,
          question: userQuestion,
          history: historyContext
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from AI Assistant.");
      }

      const data = await response.json();
      const aiAnswer = data.answer;

      // Save Q&A turn into Supabase
      const { data: insertedData, error } = await supabase
        .from('tender_qa')
        .insert({
          tender_id: tenderId,
          user_id: userId,
          question: userQuestion,
          answer: aiAnswer
        })
        .select()
        .single();

      if (error) throw error;

      // Append to local message state
      setMessages((prev) => [...prev, insertedData]);

    } catch (err: any) {
      console.error("Error in QA chat:", err);
      setMessages((prev) => [
        ...prev, 
        { 
          question: userQuestion, 
          answer: "Sorry, I ran into an error answering your question. Please try again." 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "What is the payment schedule?",
    "What are the eligibility requirements?",
    "List the major delivery deadlines.",
    "Are there any penalty or liquidation damages?"
  ];

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <MessagesSquare size={18} style={{ color: 'var(--primary)' }} />
        <h3 style={{ fontSize: '14px', fontWeight: 700 }}>AI Bidding Assistant</h3>
      </div>

      <div className="chat-messages">
        {loadingHistory ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <span className="loading-dots">Loading chat history<span></span><span></span><span></span></span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
            <Bot size={36} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>Ask follow-up questions</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ask free-form questions about payment milestones, scope details, or deadlines.</p>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all var(--transition-speed)'
                  }}
                  className="quick-question-btn"
                >
                  <HelpCircle size={12} style={{ color: 'var(--secondary)' }} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <React.Fragment key={msg.id || index}>
              {/* User message */}
              <div className="chat-message message-user">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px', fontWeight: 600, opacity: 0.8 }}>
                  <User size={12} /> Me
                </div>
                {msg.question}
              </div>
              
              {/* AI message */}
              <div className="chat-message message-ai">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--primary)' }}>
                  <Bot size={12} /> TenderIQ AI
                </div>
                <div>{renderMarkdown(msg.answer)}</div>
              </div>
            </React.Fragment>
          ))
        )}

        {loading && (
          <div className="chat-message message-ai" style={{ width: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--primary)' }}>
              <Bot size={12} /> TenderIQ AI
            </div>
            <span className="loading-dots">Thinking<span></span><span></span><span></span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            type="text"
            className="chat-input"
            placeholder="Type a question about this tender..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="chat-send-btn" disabled={loading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </form>

      <style>{`
        .quick-question-btn:hover {
          background: var(--bg-secondary) !important;
          border-color: var(--secondary) !important;
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
};
