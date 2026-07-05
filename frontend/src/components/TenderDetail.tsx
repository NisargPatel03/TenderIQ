import React, { useState, useEffect } from 'react';
import { 
  FileText, Calendar, ShieldCheck, Briefcase, DollarSign, 
  Files, ShieldAlert, Award, PhoneCall, Copy, Check, FileDown, 
  Trash2, Clock, MessageSquare
} from 'lucide-react';
import { TimelineVisualizer } from './TimelineVisualizer.tsx';
import { GoNoGoScorecard } from './GoNoGoScorecard.tsx';
import { useNotification } from './NotificationProvider';
import { ClauseComments } from './ClauseComments.tsx';
import { ProposalWriter } from './ProposalWriter.tsx';


const renderFormattedText = (text: string) => {
  if (!text) return '';
  const parts = text.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index}>{part}</strong>;
    }
    return part;
  });
};

interface TenderDetailProps {
  tender: {
    id: string;
    name: string;
    status: 'Active' | 'Submitted' | 'Expired' | 'Processing' | 'Failed';
    deadline: string | null;
    file_size: number;
    page_count: number | null;
    analysis_result: any;
    extracted_text: string;
    created_at: string;
  };
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: 'Active' | 'Submitted' | 'Expired' | 'Processing' | 'Failed') => void;
  userId: string;
  userEmail: string;
  orgId: string | null;
}


export const TenderDetail: React.FC<TenderDetailProps> = ({ 
  tender, 
  onDelete, 
  onUpdateStatus,
  userId,
  userEmail,
  orgId,
}) => {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'analysis' | 'timeline' | 'gonogo' | 'proposal'>('analysis');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('executive_summary');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCommentIdx, setActiveCommentIdx] = useState<number | null>(null);

  useEffect(() => {
    setSearchTerm('');
    setActiveCommentIdx(null);
  }, [selectedSectionKey]);

  const sections = tender.analysis_result || {};

  // Card icons config
  const sectionConfig: Record<string, { title: string; icon: any }> = {
    executive_summary: { title: "Executive Summary", icon: FileText },
    eligibility_criteria: { title: "Eligibility Criteria", icon: ShieldCheck },
    key_dates: { title: "Key Dates & Deadlines", icon: Calendar },
    scope_of_work: { title: "Scope of Work", icon: Briefcase },
    financial_requirements: { title: "Financial Requirements", icon: DollarSign },
    required_documents: { title: "Required Documents Checklist", icon: Files },
    risks_penalties: { title: "Risks & Penalties", icon: ShieldAlert },
    evaluation_criteria: { title: "Evaluation Criteria", icon: Award },
    contact_details: { title: "Contact Details", icon: PhoneCall },
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyAll = () => {
    let fullTextReport = `TenderIQ Analysis Report: ${tender.name}\n`;
    fullTextReport += `Generated: ${new Date(tender.created_at).toLocaleDateString()}\n`;
    fullTextReport += `Deadline: ${tender.deadline ? new Date(tender.deadline).toLocaleString() : 'Not Found'}\n\n`;
    fullTextReport += `=========================================\n\n`;

    Object.entries(sectionConfig).forEach(([key, config]) => {
      const data = sections[key];
      if (data && data.found) {
        fullTextReport += `${config.title.toUpperCase()}\n`;
        if (key === 'financial_requirements') {
          fullTextReport += `EMD/Bid Security: ${data.emd || 'N/A'}\n`;
          fullTextReport += `Minimum Turnover: ${data.turnover || 'N/A'}\n`;
        }
        if (key === 'contact_details') {
          fullTextReport += `Authority: ${data.authority || 'N/A'}\n`;
          fullTextReport += `Email: ${data.email || 'N/A'}\n`;
          fullTextReport += `Phone: ${data.phone || 'N/A'}\n`;
          fullTextReport += `Portal: ${data.portal || 'N/A'}\n`;
        }
        const content = data.content || data.checklist || [];
        content.forEach((bullet: string) => {
          fullTextReport += `- ${bullet}\n`;
        });
        fullTextReport += `\n`;
      }
    });

    navigator.clipboard.writeText(fullTextReport);
    showToast("Full analysis report copied to clipboard!", "success");
  };

  const handleExportPDF = () => {
    // Basic browser printing setup for saving as PDF
    window.print();
  };

  const handleExportWord = () => {
    // Generate a standard clean HTML template representing the Word Doc
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>TenderIQ Report - ${tender.name}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
          h2 { color: #0f766e; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 6px; }
          .meta { font-style: italic; color: #555; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Tender Analysis Report: ${tender.name}</h1>
        <div class="meta">
          <p><strong>Generated by:</strong> TenderIQ Procurement Portal</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Tender Deadline:</strong> ${tender.deadline ? new Date(tender.deadline).toLocaleString() : 'Not Found'}</p>
        </div>
    `;

    Object.entries(sectionConfig).forEach(([key, config]) => {
      const data = sections[key];
      if (data && data.found) {
        htmlContent += `<h2>${config.title}</h2>`;
        if (key === 'financial_requirements') {
          htmlContent += `<p><strong>EMD / Bid Security:</strong> ${data.emd || 'Not Found'}</p>`;
          htmlContent += `<p><strong>Minimum Turnover Required:</strong> ${data.turnover || 'Not Found'}</p>`;
        }
        if (key === 'contact_details') {
          htmlContent += `<p><strong>Issuing Authority:</strong> ${data.authority || 'N/A'}</p>`;
          htmlContent += `<p><strong>Contact Email:</strong> ${data.email || 'N/A'}</p>`;
          htmlContent += `<p><strong>Contact Phone:</strong> ${data.phone || 'N/A'}</p>`;
          htmlContent += `<p><strong>Tender Portal:</strong> ${data.portal || 'N/A'}</p>`;
        }
        
        const listItems = data.content || data.checklist || [];
        if (listItems.length > 0) {
          htmlContent += `<ul>`;
          listItems.forEach((bullet: string) => {
            htmlContent += `<li>${bullet}</li>`;
          });
          htmlContent += `</ul>`;
        } else {
          htmlContent += `<p>No bullet items extracted.</p>`;
        }
      }
    });

    htmlContent += `</body></html>`;

    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tender.name.replace(/\.[^/.]+$/, "")}_TenderIQ_Analysis.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDaysRemaining = () => {
    if (!tender.deadline) return null;
    const diff = new Date(tender.deadline).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const daysLeft = getDaysRemaining();

  if (tender.status === 'Processing') {
    return (
      <div className="analysis-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', textAlign: 'center', padding: '40px' }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '48px',
          maxWidth: '560px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div className="processing-spinner" style={{
            width: '64px',
            height: '64px',
            border: '4px solid rgba(16, 185, 129, 0.1)',
            borderTop: '4px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '24px'
          }}></div>
          <h2 style={{ fontSize: '22px', color: '#ffffff', marginBottom: '12px' }}>AI Compliance Ingestion Active</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            TenderIQ is currently processing your bidding package. This includes recursive document parsing, semantic text chunking, and AI compliance audit extraction. Please wait...
          </p>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--primary)', width: '60%', borderRadius: '3px', animation: 'progress-bar-loading 2s infinite ease-in-out' }}></div>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes progress-bar-loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  if (tender.status === 'Failed') {
    return (
      <div className="analysis-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', textAlign: 'center', padding: '40px' }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.03)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '16px',
          padding: '48px',
          maxWidth: '560px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <ShieldAlert size={48} color="var(--accent-red)" style={{ marginBottom: '20px' }} />
          <h2 style={{ fontSize: '22px', color: '#ffffff', marginBottom: '12px' }}>Ingestion Failed</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            We encountered an unexpected error while parsing your documents or matching vector embeddings. Please try uploading the tender package again.
          </p>
          <button 
            onClick={() => onDelete(tender.id)}
            style={{
              background: 'var(--accent-red)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background var(--transition-speed)'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#dc2626')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-red)')}
          >
            Remove Record
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-panel printable-area">
      {/* Tender Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }} className="non-printable">
        <div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>{tender.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Pages: <strong style={{ color: '#ffffff' }}>{tender.page_count || 'N/A'}</strong>
            </span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border-color)' }}></span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Uploaded: <strong style={{ color: '#ffffff' }}>{new Date(tender.created_at).toLocaleDateString()}</strong>
            </span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border-color)' }}></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status:</span>
              <select
                value={tender.status}
                onChange={(e) => onUpdateStatus(tender.id, e.target.value as any)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Active">Active</option>
                <option value="Submitted">Submitted</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {daysLeft !== null && (
            <div className={`countdown-box ${daysLeft <= 0 ? 'expired' : ''}`}>
              <Clock size={16} />
              {daysLeft > 0 ? (
                <span>{daysLeft} days remaining</span>
              ) : daysLeft === 0 ? (
                <span>Deadline Today</span>
              ) : (
                <span>Deadline Passed</span>
              )}
            </div>
          )}

          <button className="btn" onClick={handleCopyAll}>
            <Copy size={14} /> Copy All
          </button>
          <button className="btn" onClick={handleExportPDF}>
            <FileDown size={14} /> Export PDF
          </button>
          <button className="btn" onClick={handleExportWord}>
            <FileDown size={14} /> Export Word
          </button>
          <button className="btn btn-danger" onClick={() => onDelete(tender.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="view-tabs non-printable">
        <button 
          className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Analysis Report
        </button>
        <button 
          className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline Visualizer
        </button>
        <button 
          className={`tab-btn ${activeTab === 'gonogo' ? 'active' : ''}`}
          onClick={() => setActiveTab('gonogo')}
        >
          Bid Go-NoGo Scorecard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'proposal' ? 'active' : ''}`}
          onClick={() => setActiveTab('proposal')}
        >
          Proposal Writer
        </button>
      </div>

      {/* Main Tab Render */}
      {activeTab === 'analysis' && (
        <>
          {/* Split Screen View for Screen Media */}
          <div className="analysis-split-container non-printable">
            {/* Left Sidebar Navigation Menu */}
            <div className="analysis-nav-menu">
              {Object.entries(sectionConfig).map(([key, config]) => {
                const Icon = config.icon;
                const data = sections[key];
                const found = data !== undefined && data !== null && data.found !== false;
                
                return (
                  <button
                    key={key}
                    className={`analysis-nav-item ${selectedSectionKey === key ? 'active' : ''} ${!found ? 'not-found' : ''}`}
                    onClick={() => setSelectedSectionKey(key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <Icon size={16} className="nav-icon" style={{ flexShrink: 0 }} />
                      <span className="nav-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {config.title}
                      </span>
                    </div>
                    <span className={`status-dot ${found ? 'found' : 'missing'}`}></span>
                  </button>
                );
              })}
            </div>

            {/* Right Card Detail Pane */}
            <div className="analysis-card-detail">
              {(() => {
                const config = sectionConfig[selectedSectionKey];
                if (!config) return null;
                const Icon = config.icon;
                const data = sections[selectedSectionKey];
                const found = data !== undefined && data !== null && data.found !== false;
                const bullets = data?.content || data?.checklist || [];

                // Filter bullets by search term
                const filteredBullets = bullets.filter((bullet: string) =>
                  bullet.toLowerCase().includes(searchTerm.toLowerCase())
                );

                return (
                  <div className={`analysis-card ${!found ? 'not-found' : ''}`} style={{ margin: 0 }}>
                    <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="card-title-group">
                          <Icon size={18} className="card-icon" />
                          <span className="card-title">{config.title}</span>
                        </div>
                      </div>
                      
                      {found && bullets.length > 5 && (
                        <div style={{ width: '100%' }}>
                          <input
                            type="text"
                            placeholder={`Search in ${config.title.toLowerCase()}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-light)',
                              borderRadius: '6px',
                              color: '#ffffff',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {!found ? (
                        <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          Information not found in document
                        </p>
                      ) : (
                        <>
                          {selectedSectionKey === 'financial_requirements' && (
                            <div style={{ 
                              background: 'var(--bg-secondary)', 
                              padding: '12px 14px', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border-light)',
                              fontSize: '13px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div>EMD / Bid Security: <strong style={{ color: 'var(--primary)' }}>{data.emd || 'N/A'}</strong></div>
                              <div>Min Annual Turnover: <strong style={{ color: 'var(--secondary)' }}>{data.turnover || 'N/A'}</strong></div>
                            </div>
                          )}

                          {selectedSectionKey === 'contact_details' && (
                            <div style={{ 
                              background: 'var(--bg-secondary)', 
                              padding: '12px 14px', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border-light)',
                              fontSize: '13px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div>Authority: <strong>{data.authority || 'N/A'}</strong></div>
                              {data.email && <div>Email: <a href={`mailto:${data.email}`} style={{ color: 'var(--secondary)', textDecoration: 'none' }}>{data.email}</a></div>}
                              {data.phone && <div>Phone: <strong>{data.phone}</strong></div>}
                              {data.portal && <div>Portal: <a href={data.portal} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Link</a></div>}
                            </div>
                          )}

                          {bullets.length > 0 ? (
                            <div 
                              className="custom-scrollbar"
                              style={{ 
                                maxHeight: '340px', 
                                overflowY: 'auto', 
                                paddingRight: '8px' 
                              }}
                            >
                              {filteredBullets.length > 0 ? (
                                <ul className="analysis-bullets" style={{ listStyle: 'none', paddingLeft: 0 }}>
                                  {filteredBullets.map((bullet: string, idx: number) => (
                                    <li key={idx} style={{ 
                                      position: 'relative', 
                                      padding: '12px 14px', 
                                      marginBottom: '8px', 
                                      backgroundColor: 'rgba(255,255,255,0.01)', 
                                      border: '1px solid var(--border-light)', 
                                      borderRadius: '8px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px'
                                    }} className="clause-item">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                        <span style={{ fontSize: '13px', lineHeight: '1.5', flex: 1 }}>{renderFormattedText(bullet)}</span>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveCommentIdx(activeCommentIdx === idx ? null : idx);
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: activeCommentIdx === idx ? 'var(--primary)' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            borderRadius: '4px',
                                            transition: 'all 0.2s'
                                          }}
                                          className="comment-toggle-btn"
                                          title="Comment on this clause"
                                        >
                                          <MessageSquare size={14} />
                                        </button>
                                      </div>
                                      
                                      {activeCommentIdx === idx && (
                                        <ClauseComments
                                          tenderId={tender.id}
                                          sectionKey={selectedSectionKey}
                                          clauseText={bullet}
                                          userId={userId}
                                          userEmail={userEmail}
                                        />
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', margin: '10px 0' }}>
                                  No matching clauses found.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p>{data?.description || 'Data extracted.'}</p>
                          )}
                        </>
                      )}
                    </div>

                    {found && filteredBullets.length > 0 && (
                      <div className="card-footer non-printable">
                        <button 
                          className="card-copy-btn"
                          onClick={() => {
                            const copyText = filteredBullets.map((b: string) => `- ${b}`).join('\n');
                            copyToClipboard(copyText, selectedSectionKey);
                          }}
                        >
                          {copiedSection === selectedSectionKey ? (
                            <>
                              <Check size={12} /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Copy Section
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Sequential Fallback for Printing */}
          <div className="printable-only-container">
            {/* Professional Print Header */}
            <div className="print-report-header">
              <h1>Tender Analysis Report</h1>
              <h2>{tender.name}</h2>
              <div className="print-report-meta">
                <div><strong>Generated by:</strong> TenderIQ Procurement Portal</div>
                <div><strong>Analysis Date:</strong> {new Date().toLocaleDateString()}</div>
                <div><strong>Tender Status:</strong> {tender.status}</div>
                <div><strong>Tender Deadline:</strong> {tender.deadline ? new Date(tender.deadline).toLocaleString() : 'Not Found'}</div>
              </div>
            </div>

            {Object.entries(sectionConfig).map(([key, config]) => {
              const Icon = config.icon;
              const data = sections[key];
              const found = data !== undefined && data !== null && data.found !== false;
              const bullets = data?.content || data?.checklist || [];

              return (
                <div 
                  key={`print-${key}`} 
                  className={`analysis-card ${!found ? 'not-found' : ''}`}
                >
                  <div className="card-header">
                    <div className="card-title-group">
                      <Icon size={18} className="card-icon" />
                      <span className="card-title">{config.title}</span>
                    </div>
                  </div>

                  <div className="card-body">
                    {!found ? (
                      <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        Information not found in document
                      </p>
                    ) : (
                      <>
                        {key === 'financial_requirements' && (
                          <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                            <div>EMD / Bid Security: <strong>{data.emd || 'N/A'}</strong></div>
                            <div>Min Annual Turnover: <strong>{data.turnover || 'N/A'}</strong></div>
                          </div>
                        )}

                        {key === 'contact_details' && (
                          <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                            <div>Authority: <strong>{data.authority || 'N/A'}</strong></div>
                            {data.email && <div>Email: {data.email}</div>}
                            {data.phone && <div>Phone: {data.phone}</div>}
                            {data.portal && <div>Portal: {data.portal}</div>}
                          </div>
                        )}

                        {bullets.length > 0 ? (
                          <ul>
                            {bullets.map((bullet: string, idx: number) => (
                              <li key={idx}>{renderFormattedText(bullet)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>{data?.description || 'Data extracted.'}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'timeline' && (
        <TimelineVisualizer timelineData={sections.key_dates?.timeline || []} additionalInfo={sections.key_dates?.content || []} />
      )}

      {activeTab === 'gonogo' && (
        <GoNoGoScorecard tender={tender} />
      )}

      {activeTab === 'proposal' && (
        <ProposalWriter tenderId={tender.id} tenderName={tender.name} orgId={orgId} />
      )}

      <style>{`
        .clause-item:hover .comment-toggle-btn {
          color: var(--primary) !important;
          opacity: 1 !important;
        }
        .comment-toggle-btn {
          opacity: 0.6;
        }
        .comment-toggle-btn:hover {
          background-color: rgba(16, 185, 129, 0.1) !important;
          color: var(--primary) !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};
