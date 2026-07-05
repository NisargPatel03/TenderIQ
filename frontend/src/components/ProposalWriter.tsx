import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useNotification } from './NotificationProvider';
import { 
  FileText, Trash2, Loader, Sparkles, Download, 
  UploadCloud, CheckSquare, Square, AlertCircle, 
  BookOpen, CheckCircle2 
} from 'lucide-react';

interface ReferenceFile {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
}

interface ProposalWriterProps {
  tenderId: string;
  tenderName: string;
  orgId: string | null;
}

export const ProposalWriter: React.FC<ProposalWriterProps> = ({
  tenderId,
  tenderName,
  orgId,
}) => {
  const { showToast, showConfirm } = useNotification();
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Selection & Config
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  
  // Generation State
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [proposalDraft, setProposalDraft] = useState<any | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'cover' | 'tech' | 'matrix'>('cover');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const steps = [
    "Compiling active workspace references...",
    "Correlating tender scope and eligibility criteria...",
    "Drafting customized executive cover letter...",
    "Synthesizing technical response from references...",
    "Building capability compliance matrix...",
    "Polishing word styles and layouts..."
  ];

  useEffect(() => {
    if (orgId) {
      fetchReferences();
      setProposalDraft(null);
    }
  }, [orgId]);

  // Rotate loading steps for premium feedback
  useEffect(() => {
    let interval: any;
    if (generating) {
      interval = setInterval(() => {
        setGenerationStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 3500);
    } else {
      setGenerationStep(0);
    }
    return () => clearInterval(interval);
  }, [generating]);

  const fetchReferences = async () => {
    if (!orgId) return;
    setLoadingRefs(true);
    try {
      const { data, error } = await supabase
        .from('workspace_references')
        .select('id, filename, file_size, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferences(data || []);
      
      // Auto-select all references by default
      if (data) {
        setSelectedRefIds(data.map(r => r.id));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load reference library.', 'error');
    } finally {
      setLoadingRefs(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !orgId) return;
    
    const file = files[0];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(fileExt || '')) {
      showToast('Unsupported file format. Please upload PDF, DOCX, or TXT files.', 'error');
      return;
    }

    setUploading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('org_id', orgId);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/api/references/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to upload document.');
      }

      showToast(`Successfully uploaded ${file.name} to references!`, 'success');
      fetchReferences();
    } catch (err: any) {
      showToast(err.message || 'Reference upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteReference = (id: string, name: string) => {
    showConfirm({
      title: 'Remove Reference Material',
      message: `Are you sure you want to delete "${name}" from the reference library? This cannot be undone.`,
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('workspace_references')
            .delete()
            .eq('id', id);

          if (error) throw error;
          showToast('Reference document removed successfully.', 'success');
          setReferences(prev => prev.filter(r => r.id !== id));
          setSelectedRefIds(prev => prev.filter(item => item !== id));
        } catch (err: any) {
          showToast(err.message || 'Failed to delete reference.', 'error');
        }
      }
    });
  };

  const toggleSelectReference = (id: string) => {
    setSelectedRefIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleGenerateProposal = async () => {
    if (!orgId) return;
    setGenerating(true);
    setProposalDraft(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/api/proposal/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          tender_id: tenderId,
          org_id: orgId,
          custom_instructions: customInstructions,
          reference_ids: selectedRefIds,
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Drafting failed.');
      }

      const data = await res.json();
      setProposalDraft(data);
      showToast('Proposal drafted successfully! Review your draft below.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Proposal drafting failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadWordDoc = async () => {
    if (!proposalDraft) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/api/proposal/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tender_name: tenderName,
          draft: proposalDraft
        })
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tenderName.replace(/\s+/g, '_')}_Bid_Proposal.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Styled Word Document downloaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to download document.', 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr', gap: '24px', minHeight: '500px' }}>
      
      {/* LEFT COLUMN: Reference Library & Config */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Reference Library Card */}
        <div className="analysis-card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '15px' }}>Reference Library</h3>
            </div>
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px dashed var(--primary)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              color: 'var(--primary)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }} className="hover-primary-glow">
              {uploading ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <UploadCloud size={14} />
              )}
              {uploading ? 'Parsing...' : 'Upload'}
              <input type="file" onChange={handleFileUpload} accept=".pdf,.docx,.txt" style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
            Upload winning proposals, team resumes, and capability decks to train the bid compiler.
          </p>

          {/* Reference List */}
          {loadingRefs ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <Loader size={16} className="animate-spin" style={{ marginBottom: '8px' }} />
              <div>Fetching library files...</div>
            </div>
          ) : references.length === 0 ? (
            <div style={{
              border: '1px dashed var(--border-light)',
              borderRadius: '8px',
              padding: '30px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.01)'
            }}>
              <FileText size={32} style={{ color: 'rgba(255, 255, 255, 0.08)', marginBottom: '10px' }} />
              <div>No reference materials uploaded yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
              {references.map(ref => (
                <div key={ref.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light)',
                  transition: 'border-color 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <button 
                      onClick={() => toggleSelectReference(ref.id)}
                      style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer' }}
                    >
                      {selectedRefIds.includes(ref.id) ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {ref.filename}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {(ref.file_size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDeleteReference(ref.id, ref.filename)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    className="delete-member-btn"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configuration Card */}
        <div className="analysis-card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--primary)' }} /> Proposal Configuration
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Selected Reference Materials: <strong>{selectedRefIds.length} file(s)</strong>
            </label>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Custom Drafting Instructions (Optional):
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Write in a highly technical and formal tone. Highlight our ISO 27001 cybersecurity certification. Emphasize senior engineering resumes."
                style={{
                  width: '100%',
                  height: '100px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '10px',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  resize: 'none',
                  outline: 'none'
                }}
                className="focus-primary-glow"
              />
            </div>

            <button
              onClick={handleGenerateProposal}
              disabled={generating || selectedRefIds.length === 0}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}
            >
              {generating ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {generating ? 'Compiling Proposal...' : 'Compile Bid Proposal'}
            </button>

            {selectedRefIds.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: 'var(--accent-red)', marginTop: '4px' }}>
                <AlertCircle size={12} />
                <span>You must upload and select at least one reference document.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Generation loading or Preview panel */}
      <div className="analysis-card" style={{ 
        padding: '24px', 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: proposalDraft || generating ? 'flex-start' : 'center',
        alignItems: proposalDraft || generating ? 'stretch' : 'center',
        textAlign: proposalDraft || generating ? 'left' : 'center',
        minHeight: '520px'
      }}>
        {generating ? (
          /* STEPPED LOADING SCREEN */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '24px' }}>
              <div className="animate-ping" style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                top: 0,
                left: 0
              }}></div>
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-primary)',
                border: '2px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Sparkles size={28} className="animate-pulse" />
              </div>
            </div>

            <h3 style={{ fontSize: '16px', marginBottom: '8px', color: '#ffffff' }}>TenderIQ AI Writer compiling...</h3>
            <p style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '500', marginBottom: '24px', minHeight: '20px' }} className="animate-pulse">
              {steps[generationStep]}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '320px' }}>
              {steps.map((stepText, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '11px',
                  color: idx < generationStep ? 'var(--text-muted)' : idx === generationStep ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
                  transition: 'color 0.3s'
                }}>
                  {idx < generationStep ? (
                    <CheckCircle2 size={12} style={{ color: 'var(--primary)' }} />
                  ) : idx === generationStep ? (
                    <Loader size={12} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  ) : (
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.2)' }}></div>
                  )}
                  <span>{stepText.replace('...', '')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : proposalDraft ? (
          /* LIVE PREVIEW & DOWNLOAD PANEL */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Draft Bid Proposal</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tailored response compiled in real-time</span>
              </div>

              <button 
                onClick={handleDownloadWordDoc}
                className="btn btn-primary"
                style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} /> Download Styled .DOCX
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActivePreviewTab('cover')}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light)',
                  background: activePreviewTab === 'cover' ? 'var(--primary)' : 'var(--bg-tertiary)',
                  color: activePreviewTab === 'cover' ? '#000000' : 'var(--text-secondary)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                1. Cover Letter
              </button>
              <button
                onClick={() => setActivePreviewTab('tech')}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light)',
                  background: activePreviewTab === 'tech' ? 'var(--primary)' : 'var(--bg-tertiary)',
                  color: activePreviewTab === 'tech' ? '#000000' : 'var(--text-secondary)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                2. Technical Response
              </button>
              <button
                onClick={() => setActivePreviewTab('matrix')}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light)',
                  background: activePreviewTab === 'matrix' ? 'var(--primary)' : 'var(--bg-tertiary)',
                  color: activePreviewTab === 'matrix' ? '#000000' : 'var(--text-secondary)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                3. Capability Matrix
              </button>
            </div>

            {/* PREVIEW CONTAINER */}
            <div style={{
              flex: 1,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '16px',
              overflowY: 'auto',
              maxHeight: '340px',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace'
            }}>
              {activePreviewTab === 'cover' && (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {proposalDraft.cover_letter}
                </div>
              )}

              {activePreviewTab === 'tech' && (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {proposalDraft.technical_response}
                </div>
              )}

              {activePreviewTab === 'matrix' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', color: '#ffffff' }}>
                      <th style={{ padding: '8px', width: '35%' }}>Requirement</th>
                      <th style={{ padding: '8px', width: '20%' }}>Status</th>
                      <th style={{ padding: '8px', width: '45%' }}>Supporting Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposalDraft.capability_matrix?.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{item.requirement}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: '600',
                            backgroundColor: item.compliance_status?.includes('Exceeds') || item.compliance_status === 'Compliant'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                            color: item.compliance_status?.includes('Exceeds') || item.compliance_status === 'Compliant'
                              ? 'var(--primary)'
                              : 'var(--accent-red)'
                          }}>
                            {item.compliance_status}
                          </span>
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{item.evidence_reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        ) : (
          /* EMPTY STATE */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '8px', color: '#ffffff' }}>Auto-Bid Draft Preview</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: '1.4' }}>
              Configure your reference library files, append custom prompts, and click compile to draft the proposal.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
