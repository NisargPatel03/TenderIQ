import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Send, MessageSquare, Trash2 } from 'lucide-react';
import { useNotification } from './NotificationProvider';

interface Comment {
  id: string;
  user_email: string;
  comment_text: string;
  created_at: string;
  user_id: string;
}

interface ClauseCommentsProps {
  tenderId: string;
  sectionKey: string;
  clauseText: string;
  userId: string;
  userEmail: string;
}

export const ClauseComments: React.FC<ClauseCommentsProps> = ({
  tenderId,
  sectionKey,
  clauseText,
  userId,
  userEmail,
}) => {
  const { showToast } = useNotification();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments();

    // Subscribe to real-time updates for clause_comments on this tender/section
    const channel = supabase
      .channel(`comments_${tenderId}_${sectionKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clause_comments',
          filter: `tender_id=eq.${tenderId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as Comment;
            // Only add if it belongs to this specific clause
            // Note: Since clauseText might be long, we match it
            if ((payload.new as any).clause_text === clauseText) {
              setComments((prev) => {
                if (prev.some((c) => c.id === newRecord.id)) return prev;
                return [...prev, newRecord];
              });
              
              // Trigger mention alert
              if (newRecord.comment_text.includes(`@${userEmail}`)) {
                showToast(`New mention from ${newRecord.user_email}!`, 'info');
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenderId, sectionKey, clauseText, userEmail]);

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('clause_comments')
        .select('*')
        .eq('tender_id', tenderId)
        .eq('section_key', sectionKey)
        .eq('clause_text', clauseText)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err: any) {
      console.error('Failed to load comments:', err);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('clause_comments')
        .insert({
          tender_id: tenderId,
          section_key: sectionKey,
          clause_text: clauseText,
          user_id: userId,
          user_email: userEmail,
          comment_text: text,
        });

      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch (err: any) {
      showToast(err.message || 'Failed to post comment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('clause_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      showToast('Comment deleted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete comment.', 'error');
    }
  };

  const formatCommentText = (text: string) => {
    // Regex to match email mentions (@name@company.com)
    const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/g;
    const parts = text.split(mentionRegex);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
      // Every odd part is a matched email mention
      if (i % 2 === 1) {
        const isMe = part === userEmail;
        return (
          <span
            key={i}
            style={{
              color: isMe ? '#ffffff' : 'var(--primary)',
              backgroundColor: isMe ? 'var(--primary)' : 'rgba(16, 185, 129, 0.1)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '600',
              fontSize: '11px',
              margin: '0 2px',
            }}
          >
            @{part.split('@')[0]}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div style={{
      marginTop: '12px',
      backgroundColor: 'rgba(7, 11, 19, 0.6)',
      border: '1px solid var(--border-light)',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* Comments List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '180px',
        overflowY: 'auto',
        paddingRight: '4px'
      }}>
        {comments.length === 0 ? (
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 0'
          }}>
            <MessageSquare size={12} /> Leave the first comment on this clause
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '6px 8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  {c.user_email.split('@')[0]}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {c.user_id === userId && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      className="delete-comment-btn"
                    >
                      <Trash2 size={10} hover-color="var(--accent-red)" />
                    </button>
                  )}
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>
                {formatCommentText(c.comment_text)}
              </p>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handlePostComment} style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        marginTop: '2px'
      }}>
        <input
          type="text"
          className="form-control"
          placeholder="Write comment... (use @email to tag)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-light)',
            borderRadius: '6px',
            color: '#ffffff',
            padding: '6px 10px',
            fontSize: '12px'
          }}
          disabled={loading}
        />
        <button
          type="submit"
          style={{
            background: 'var(--primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s'
          }}
          disabled={loading || !newComment.trim()}
        >
          <Send size={12} />
        </button>
      </form>
      <style>{`
        .delete-comment-btn:hover {
          color: var(--accent-red) !important;
        }
      `}</style>
    </div>
  );
};
