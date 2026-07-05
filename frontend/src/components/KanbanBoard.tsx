import React, { useState } from 'react';
import type { Tender } from './Sidebar';
import { supabase } from '../utils/supabase';
import { useNotification } from './NotificationProvider';
import { Calendar, FileType, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';

interface KanbanBoardProps {
  tenders: Tender[];
  onSelectTender: (id: string) => void;
  onDeleteTender: (id: string) => void;
  onTenderStageChange: (tenderId: string, newStage: string) => void;
}

const STAGES = [
  { id: 'Discovered', label: 'Discovered', color: 'var(--text-muted)' },
  { id: 'Under Audit', label: 'Under Audit', color: 'var(--accent-gold)' },
  { id: 'Approved to Bid', label: 'Approved to Bid', color: 'var(--secondary)' },
  { id: 'Writing Proposal', label: 'Writing Proposal', color: '#8b5cf6' }, // Violet
  { id: 'Submitted', label: 'Submitted', color: 'var(--primary)' }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tenders,
  onSelectTender,
  onDeleteTender,
  onTenderStageChange,
}) => {
  const { showToast, showConfirm } = useNotification();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const getFriendlySize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stage: string) => {
    if (!draggedId) return;
    await updateStage(draggedId, stage);
    setDraggedId(null);
  };

  const updateStage = async (tenderId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('tenders')
        .update({ kanban_stage: newStage })
        .eq('id', tenderId);

      if (error) throw error;
      onTenderStageChange(tenderId, newStage);
      showToast(`Tender stage updated to ${newStage}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update stage.', 'error');
    }
  };

  const handleMoveLeft = async (tender: Tender) => {
    const currentIndex = STAGES.findIndex(s => s.id === (tender as any).kanban_stage);
    if (currentIndex > 0) {
      const newStage = STAGES[currentIndex - 1].id;
      await updateStage(tender.id, newStage);
    }
  };

  const handleMoveRight = async (tender: Tender) => {
    const currentIndex = STAGES.findIndex(s => s.id === (tender as any).kanban_stage);
    if (currentIndex < STAGES.length - 1) {
      const newStage = STAGES[currentIndex + 1].id;
      await updateStage(tender.id, newStage);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px',
      overflow: 'hidden'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-headings)' }}>
          Multi-User Kanban Bid Board
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Drag and drop tenders, or use controls to track proposal workflow stages from Discovery to Submission.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '16px',
        flex: 1,
        overflowX: 'auto',
        paddingBottom: '16px',
        minHeight: '400px'
      }}>
        {STAGES.map((stage) => {
          const columnTenders = tenders.filter(t => ((t as any).kanban_stage || 'Discovered') === stage.id);
          
          return (
            <div
              key={stage.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                padding: '16px 12px',
                minWidth: '240px',
                height: '100%',
                overflow: 'hidden'
              }}
            >
              {/* Column Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-light)'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: stage.color }}>
                  {stage.label}
                </span>
                <span style={{
                  fontSize: '11px',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  color: 'var(--text-secondary)',
                  fontWeight: '600'
                }}>
                  {columnTenders.length}
                </span>
              </div>

              {/* Column Content */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                flex: 1,
                overflowY: 'auto',
                paddingRight: '2px'
              }}>
                {columnTenders.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '30px 10px',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    border: '1px dashed var(--border-light)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100px'
                  }}>
                    Drag tenders here
                  </div>
                ) : (
                  columnTenders.map((tender) => {
                    const currentIndex = STAGES.findIndex(s => s.id === ((tender as any).kanban_stage || 'Discovered'));
                    
                    return (
                      <div
                        key={tender.id}
                        draggable
                        onDragStart={() => handleDragStart(tender.id)}
                        onClick={() => onSelectTender(tender.id)}
                        className="kanban-card"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '8px',
                          padding: '12px',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#ffffff',
                          marginBottom: '8px',
                          wordBreak: 'break-word',
                          lineHeight: '1.4'
                        }}>
                          {tender.name}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <FileType size={11} /> {getFriendlySize(tender.file_size)}
                          </div>
                          {tender.deadline && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent-gold)' }}>
                              <Calendar size={11} /> {new Date(tender.deadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Action buttons (Move left/right/delete) */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px solid rgba(255,255,255,0.03)',
                          paddingTop: '8px'
                        }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              disabled={currentIndex === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveLeft(tender);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                                cursor: currentIndex === 0 ? 'default' : 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              className="kanban-action-btn"
                            >
                              <ArrowLeft size={12} />
                            </button>
                            <button
                              disabled={currentIndex === STAGES.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveRight(tender);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: currentIndex === STAGES.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                                cursor: currentIndex === STAGES.length - 1 ? 'default' : 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              className="kanban-action-btn"
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showConfirm({
                                title: 'Delete Tender Audit',
                                message: `Are you sure you want to permanently delete "${tender.name}"? This action cannot be undone.`,
                                confirmText: 'Delete',
                                isDanger: true,
                                onConfirm: () => {
                                  onDeleteTender(tender.id);
                                }
                              });
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            className="kanban-delete-btn"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        .kanban-card:hover {
          border-color: var(--primary) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .kanban-action-btn:hover:not(:disabled) {
          background-color: var(--bg-secondary) !important;
          color: #ffffff !important;
        }
        .kanban-delete-btn:hover {
          color: var(--accent-red) !important;
        }
      `}</style>
    </div>
  );
};
