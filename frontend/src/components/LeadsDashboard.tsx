import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { 
  Sparkles, 
  Settings, 
  RefreshCw, 
  Import, 
  CheckCircle, 
  Globe, 
  DollarSign, 
  Calendar, 
  Info, 
  ChevronRight, 
  Save, 
  HelpCircle 
} from 'lucide-react';
import { useNotification } from './NotificationProvider';

const SlackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.042zM8.823 5.043a2.528 2.528 0 0 1 2.52-2.522 2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522a2.528 2.528 0 0 1-2.52-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.522 2.522H3.78a2.528 2.528 0 0 1-2.522-2.522V8.824a2.528 2.528 0 0 1 2.522-2.52h5.043zm10.135 3.761a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.52 2.52v2.52h-2.52a2.528 2.528 0 0 1-2.522-2.52zm-1.262 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V3.78a2.528 2.528 0 0 1 2.522-2.522h5.043a2.528 2.528 0 0 1 2.52 2.522v5.043zm-3.78 10.134a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522a2.528 2.528 0 0 1 2.52 2.52zm0-1.261a2.528 2.528 0 0 1-2.52-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.522h5.043a2.528 2.528 0 0 1 2.522 2.522v5.043a2.528 2.528 0 0 1-2.522 2.52z"/>
  </svg>
);

interface Lead {
  id: string;
  title: string;
  portal_name: string;
  tender_value: string;
  deadline: string;
  description: string;
  compatibility_score: number;
  compatibility_reason: string;
  imported: boolean;
  created_at: string;
}

interface LeadsDashboardProps {
  activeOrgId: string | null;
}

export const LeadsDashboard: React.FC<LeadsDashboardProps> = ({ activeOrgId }) => {
  const { showToast } = useNotification();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings states
  const [profileText, setProfileText] = useState('');
  const [keywords, setKeywords] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Selected lead for detail modal/drawer
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrgId) {
      fetchSettings();
      fetchLeads();
    }
  }, [activeOrgId]);

  const fetchSettings = async () => {
    if (!activeOrgId) return;
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${baseUrl}/api/leads/settings?org_id=${activeOrgId}`, {
        headers: {
          'Authorization': session ? `Bearer ${session.access_token}` : '',
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProfileText(data.company_profile || '');
        setKeywords(data.alert_keywords || '');
        setSlackWebhook(data.slack_webhook || '');
      }
    } catch (err) {
      console.error("Failed to load leads settings:", err);
    }
  };

  const fetchLeads = async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${baseUrl}/api/leads?org_id=${activeOrgId}`, {
        headers: {
          'Authorization': session ? `Bearer ${session.access_token}` : '',
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLeads(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch crawled leads:", err);
      showToast("Failed to retrieve leads.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;
    setSaveLoading(true);
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${baseUrl}/api/leads/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({
          org_id: activeOrgId,
          company_profile: profileText,
          alert_keywords: keywords,
          slack_webhook: slackWebhook,
        }),
      });

      if (response.ok) {
        showToast("Lead settings saved successfully!", "success");
        setShowSettings(false);
      } else {
        throw new Error("Failed to save settings.");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update settings.", "error");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTriggerCrawl = async () => {
    if (!activeOrgId) return;
    if (!profileText.trim() && !keywords.trim()) {
      showToast("Please save your company profile or keywords first to run customized matching.", "info");
      setShowSettings(true);
      return;
    }

    setCrawling(true);
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${baseUrl}/api/leads/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ org_id: activeOrgId }),
      });

      if (response.ok) {
        const data = await response.json();
        showToast(`Scrape completed! Found ${data.new_matches_count} new opportunities.`, "success");
        fetchLeads();
      } else {
        throw new Error("Failed to execute crawl.");
      }
    } catch (err: any) {
      showToast(err.message || "Crawler execution failed.", "error");
    } finally {
      setCrawling(false);
    }
  };

  const handleImportLead = async (lead: Lead) => {
    setImportingId(lead.id);
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${baseUrl}/api/leads/${lead.id}/import`, {
        method: 'POST',
        headers: {
          'Authorization': session ? `Bearer ${session.access_token}` : '',
        }
      });

      if (response.ok) {
        showToast(`"${lead.title}" imported successfully to active workspace!`, "success");
        // Update local state to mark as imported
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, imported: true } : l));
        if (selectedLead && selectedLead.id === lead.id) {
          setSelectedLead(prev => prev ? { ...prev, imported: true } : null);
        }
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Import failed.");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to import lead.", "error");
    } finally {
      setImportingId(null);
    }
  };

  const formatDeadline = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getScoreBadgeStyles = (score: number) => {
    if (score >= 80) return { bg: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--primary)' };
    if (score >= 60) return { bg: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--accent-gold)' };
    return { bg: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--accent-red)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#ffffff' }}>
      
      {/* Header Panel */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        padding: '20px 24px',
        borderRadius: '16px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Sparkles size={22} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Automated RFP Lead Finder</h2>
            <span style={{
              fontSize: '11px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--primary)',
              padding: '2px 8px',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 500
            }}>AI Portal Scraper</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Daily background crawlers target government procurement portals matching opportunities against your capability settings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowSettings(!showSettings)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}
          >
            <Settings size={16} />
            <span>Target Criteria</span>
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={handleTriggerCrawl}
            disabled={crawling}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', justifyContent: 'center', minWidth: '150px' }}
          >
            <RefreshCw size={16} className={crawling ? 'spin-anim' : ''} />
            <span>{crawling ? 'Scanning Portals...' : 'Scan Portals'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace split */}
      <div style={{ display: 'grid', gridTemplateColumns: showSettings ? '1fr 360px' : '1fr', gap: '20px', transition: 'all 0.3s ease' }}>
        
        {/* Leads Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 0',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <RefreshCw size={36} className="spin-anim" style={{ color: 'var(--primary)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading crawled opportunities...</span>
            </div>
          ) : leads.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px'
            }}>
              <Globe size={48} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              <div style={{ maxWidth: '400px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px' }}>No RFP Leads Tracked Yet</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Define your capability criteria and run a portal scan. The crawler will scrape active government sites and evaluate bids matching your business profile.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowSettings(true)}>
                Set Up Bidding Profile
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leads.map((lead) => {
                const styles = getScoreBadgeStyles(lead.compatibility_score);
                return (
                  <div 
                    key={lead.id}
                    className="glass-card"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '20px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-secondary)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 500
                        }}>{lead.portal_name}</span>
                        
                        <span style={{
                          fontSize: '11px',
                          backgroundColor: styles.bg,
                          border: styles.border,
                          color: styles.color,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>{lead.compatibility_score}% Compatibility Match</span>

                        {lead.imported && (
                          <span style={{
                            fontSize: '11px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--primary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 500
                          }}>
                            <CheckCircle size={10} /> Active Workspace
                          </span>
                        )}
                      </div>

                      <h3 style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 600,
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>{lead.title}</h3>

                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.4'
                      }}>{lead.compatibility_reason}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                          <DollarSign size={13} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontWeight: 500 }}>{lead.tender_value}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                          <Calendar size={13} />
                          <span>Due: {formatDeadline(lead.deadline)}</span>
                        </div>
                      </div>
                      
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings Sidebar Card */}
        {showSettings && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            padding: '20px',
            height: 'fit-content',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'sticky',
            top: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Crawl & Match Setup</h3>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >Close</button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Search Keywords
                  <span title="Comma-separated keywords matching tender portals (e.g. transformer, solar, installation)" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <HelpCircle size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                  </span>
                </label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="e.g. transformer, power grid, solar"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    width: '100%'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Company Profile & Capabilities
                </label>
                <textarea 
                  className="form-control"
                  placeholder="Describe your credentials, engineering/technical capacity, maximum contract value, turnover, and certifications to match against eligibility specs."
                  value={profileText}
                  onChange={(e) => setProfileText(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    minHeight: '130px',
                    lineHeight: '1.5',
                    width: '100%',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SlackIcon style={{ width: '13px', height: '13px', color: '#E01E5A' }} /> Slack Integration Webhook
                </label>
                <input 
                  type="url"
                  className="form-control"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    width: '100%'
                  }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={saveLoading}
                style={{ width: '100%', height: '40px', justifyContent: 'center', marginTop: '6px' }}
              >
                <Save size={16} />
                <span>{saveLoading ? 'Saving Setup...' : 'Save Settings'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Selected Lead Detail Modal */}
      {selectedLead && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxShadow: 'var(--shadow-glow)',
            color: '#ffffff'
          }}>
            
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 500,
                  display: 'inline-block',
                  marginBottom: '8px'
                }}>{selectedLead.portal_name}</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, lineHeight: '1.4' }}>{selectedLead.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '0 4px'
                }}
              >&times;</button>
            </div>

            {/* Content scroll area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '6px', marginBottom: '20px' }}>
              
              {/* Suitability block */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <Sparkles size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>TenderIQ Compatibility Rank</span>
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--primary)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>{selectedLead.compatibility_score}% Score</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {selectedLead.compatibility_reason}
                  </p>
                </div>
              </div>

              {/* Core attributes grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <DollarSign size={18} style={{ color: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Estimated Value</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{selectedLead.tender_value}</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Calendar size={18} style={{ color: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bidding Deadline</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{formatDeadline(selectedLead.deadline)}</div>
                  </div>
                </div>
              </div>

              {/* Requirement Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <Info size={14} />
                  <span>Opportunity Description & Scope</span>
                </div>
                <div style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  padding: '16px',
                  fontSize: '13.5px',
                  lineHeight: '1.6',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-line'
                }}>
                  {selectedLead.description}
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedLead(null)}>
                Close
              </button>
              
              <button 
                className="btn btn-primary"
                onClick={() => handleImportLead(selectedLead)}
                disabled={selectedLead.imported || importingId !== null}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Import size={16} />
                <span>{selectedLead.imported ? 'Imported to Workspace' : importingId ? 'Importing Lead...' : 'Import to Active Workspace'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
