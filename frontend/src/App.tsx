import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import type { Tender } from './components/Sidebar';
import { UploadZone } from './components/UploadZone';
import { TenderDetail } from './components/TenderDetail';
import { ChatBot } from './components/ChatBot';
import { FolderOpen, FileCheck, Sparkles, CheckCircle2, Menu, X, Columns } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkspaceSettingsModal } from './components/WorkspaceSettingsModal';
import { KanbanBoard } from './components/KanbanBoard';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [activeTenderId, setActiveTenderId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Multi-tenancy states
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'upload' | 'kanban'>('upload');

  // 1. Listen to Auth State changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch or auto-create organizations
  const initWorkspaces = async () => {
    if (!session?.user) return;
    try {
      // 1. Fetch organizations where user is a member
      const { data: memberOrgs, error: memberError } = await supabase
        .from('org_members')
        .select('org_id, role, organizations(id, name, owner_id)')
        .eq('user_id', session.user.id);

      if (memberError) throw memberError;

      const fetchedOrgs = (memberOrgs || [])
        .map((m: any) => m.organizations)
        .filter((o: any) => o !== null);

      // Check if user is the direct owner of organizations they are not in org_members for
      const { data: ownedOrgs, error: ownerError } = await supabase
        .from('organizations')
        .select('id, name, owner_id')
        .eq('owner_id', session.user.id);

      if (ownerError) throw ownerError;

      // Merge and remove duplicates
      const orgMap = new Map();
      fetchedOrgs.forEach((o: any) => orgMap.set(o.id, o));
      (ownedOrgs || []).forEach((o: any) => orgMap.set(o.id, o));

      let finalOrgs = Array.from(orgMap.values());

      // 2. If no organizations exist, auto-create a Personal Workspace
      if (finalOrgs.length === 0) {
        const emailPrefix = session.user.email?.split('@')[0] || 'My';
        const personalName = `${emailPrefix}'s Workspace`;

        const { data: newOrg, error: createOrgError } = await supabase
          .from('organizations')
          .insert({
            name: personalName,
            owner_id: session.user.id
          })
          .select()
          .single();

        if (createOrgError) throw createOrgError;

        // Also add user as Owner in org_members
        const { error: memberInsertError } = await supabase
          .from('org_members')
          .insert({
            org_id: newOrg.id,
            user_id: session.user.id,
            user_email: session.user.email || '',
            role: 'Owner'
          });

        if (memberInsertError) throw memberInsertError;

        finalOrgs = [newOrg];
      }

      setOrgs(finalOrgs);
      
      // Default to the first organization if none is active or active is not in the list
      const savedOrgId = localStorage.getItem(`tenderiq_active_org_${session.user.id}`);
      const matchedOrg = finalOrgs.find(o => o.id === savedOrgId);
      const targetOrgId = matchedOrg ? matchedOrg.id : finalOrgs[0].id;
      
      setActiveOrgId(targetOrgId);
      localStorage.setItem(`tenderiq_active_org_${session.user.id}`, targetOrgId);
    } catch (err) {
      console.error("Workspace initialization error:", err);
    }
  };

  useEffect(() => {
    if (session?.user) {
      initWorkspaces();
    }
  }, [session]);

  // 2. Fetch Tenders list from Supabase
  const fetchTenders = async () => {
    if (!session?.user || !activeOrgId) return;
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .eq('org_id', activeOrgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);
    } catch (err) {
      console.error("Error fetching tenders:", err);
    }
  };

  useEffect(() => {
    if (session?.user && activeOrgId) {
      fetchTenders();
    }
  }, [session, activeOrgId]);

  // 3. Poll status of 'Processing' tenders every 3s — works because Render
  //    runs background tasks to completion (no serverless kill).
  useEffect(() => {
    const processingTenders = tenders.filter(t => t.status === 'Processing');
    if (processingTenders.length === 0 || !activeOrgId) return;

    const interval = setInterval(async () => {
      try {
        const { data: freshList, error } = await supabase
          .from('tenders')
          .select('*')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: false });

        if (error || !freshList) return;

        // Check if any previously-Processing tender just became Active
        const prevActiveId = activeTenderId;
        const wasProcessing = tenders.find(t => t.id === prevActiveId && t.status === 'Processing');
        const nowActive = freshList.find(t => t.id === prevActiveId && t.status === 'Active');

        setTenders(freshList);

        if (wasProcessing && nowActive) {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#ffffff']
          });
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [tenders, activeTenderId, activeOrgId]);

  const handleAuthSuccess = () => {
    // Session is updated automatically by listener
  };

  const handleUploadStart = () => {
    // Optional loader styling trigger
  };

  const handleUploadSuccess = async (processingTender: any) => {
    // Backend returned 202 — tender is still Processing.
    // Add it to the list immediately so the sidebar badge shows.
    // The polling loop above will detect when it becomes Active and fire confetti.
    setTenders((prev) => {
      const filtered = prev.filter(t => t.id !== processingTender.id);
      return [processingTender, ...filtered];
    });
    setActiveTenderId(processingTender.id);
    setShowUploadForm(false);
  };

  const handleUploadError = (err: string) => {
    console.error("Upload error details:", err);
  };

  const handleDeleteTender = async (id: string) => {
    try {
      const { error } = await supabase.from('tenders').delete().eq('id', id);
      if (error) throw error;
      
      setTenders((prev) => prev.filter((t) => t.id !== id));
      if (activeTenderId === id) {
        setActiveTenderId(null);
        setShowUploadForm(true);
      }
    } catch (err) {
      console.error("Error deleting tender:", err);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'Active' | 'Submitted' | 'Expired' | 'Processing' | 'Failed') => {
    try {
      const { error } = await supabase
        .from('tenders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setTenders((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    } catch (err) {
      console.error("Error updating tender status:", err);
    }
  };

  const handleCreateWorkspace = async () => {
    const name = prompt("Enter a name for your new team workspace:");
    if (!name || !name.trim()) return;

    try {
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: name.trim(),
          owner_id: session.user.id
        })
        .select()
        .single();

      if (createOrgError) throw createOrgError;

      // Add user as Owner in org_members
      const { error: memberInsertError } = await supabase
        .from('org_members')
        .insert({
          org_id: newOrg.id,
          user_id: session.user.id,
          user_email: session.user.email || '',
          role: 'Owner'
        });

      if (memberInsertError) throw memberInsertError;

      setOrgs(prev => [...prev, newOrg]);
      setActiveOrgId(newOrg.id);
      localStorage.setItem(`tenderiq_active_org_${session.user.id}`, newOrg.id);
      
      confetti({
        particleCount: 80,
        spread: 50,
        colors: ['#10b981', '#ffffff']
      });
    } catch (err) {
      console.error("Failed to create workspace:", err);
    }
  };

  const handleTenderStageChange = (tenderId: string, newStage: string) => {
    setTenders((prev) =>
      prev.map((t) => (t.id === tenderId ? { ...t, kanban_stage: newStage } : t))
    );
  };

  const activeTender = tenders.find((t) => t.id === activeTenderId);

  // Compute metrics overview
  const totalAnalyzed = tenders.length;
  const activeBids = tenders.filter(t => t.status === 'Active').length;
  const submittedBids = tenders.filter(t => t.status === 'Submitted').length;

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <span className="loading-dots" style={{ fontSize: '16px' }}>Loading workspace session<span></span><span></span><span></span></span>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Header Bar */}
      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="mobile-logo-text">TenderIQ</span>
        <div style={{ width: '20px' }}></div>
      </div>

      {/* Sidebar Overlay Backdrop */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar List */}
      <Sidebar
        tenders={tenders}
        activeTenderId={activeTenderId}
        onSelectTender={(id) => {
          setActiveTenderId(id);
          setShowUploadForm(id === null);
          setSidebarOpen(false); // Close drawer on selection
        }}
        onDeleteTender={handleDeleteTender}
        onNewTenderClick={() => {
          setActiveTenderId(null);
          setShowUploadForm(true);
          setSidebarOpen(false); // Close drawer
        }}
        userEmail={session.user.email || 'Guest User'}
        orgs={orgs}
        activeOrgId={activeOrgId}
        onSelectOrg={(id) => {
          setActiveOrgId(id);
          localStorage.setItem(`tenderiq_active_org_${session.user.id}`, id);
          setActiveTenderId(null);
          setShowUploadForm(true);
        }}
        onCreateOrg={handleCreateWorkspace}
        onManageTeam={() => setShowTeamModal(true)}
      />

      {/* Main Workspace Frame */}
      <main className={`main-workspace ${activeTender ? 'workspace-active' : ''}`}>
        {showUploadForm ? (
          /* Upload Dashboard screen */
          <>
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                Procurement Intelligence Center
              </h2>

              <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '2px' }}>
                <button
                  onClick={() => setActiveDashboardTab('upload')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: activeDashboardTab === 'upload' ? 'var(--bg-tertiary)' : 'transparent',
                    color: activeDashboardTab === 'upload' ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Sparkles size={14} /> Upload & Analytics
                </button>
                <button
                  onClick={() => setActiveDashboardTab('kanban')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: activeDashboardTab === 'kanban' ? 'var(--bg-tertiary)' : 'transparent',
                    color: activeDashboardTab === 'kanban' ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Columns size={14} /> Kanban Bid Board
                </button>
              </div>
            </div>

            {activeDashboardTab === 'upload' ? (
              <div className="dashboard-grid">
                {/* Stats overview rows */}
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: 'var(--secondary)' }}>
                      <FolderOpen size={24} />
                    </div>
                    <div className="stat-details">
                      <h3>{totalAnalyzed}</h3>
                      <p>Total Tenders Audited</p>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: 'var(--primary)' }}>
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="stat-details">
                      <h3>{activeBids}</h3>
                      <p>Active Bid Pursuits</p>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: 'var(--accent-gold)' }}>
                      <FileCheck size={24} />
                    </div>
                    <div className="stat-details">
                      <h3>{submittedBids}</h3>
                      <p>Submitted Proposals</p>
                    </div>
                  </div>
                </div>

                {/* Upload drag-n-drop workspace */}
                <UploadZone
                  onUploadStart={handleUploadStart}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  activeOrgId={activeOrgId}
                />
              </div>
            ) : (
              <div style={{ flex: 1, height: 'calc(100% - 60px)', overflow: 'hidden' }}>
                <KanbanBoard
                  tenders={tenders}
                  onSelectTender={(id) => {
                    setActiveTenderId(id);
                    setShowUploadForm(false);
                  }}
                  onDeleteTender={handleDeleteTender}
                  onTenderStageChange={handleTenderStageChange}
                />
              </div>
            )}
          </>
        ) : (
          /* Split Workspace Screen (Detail sections + custom Chatbot panel) */
          activeTender && (
            <div className="tender-workspace">
              {/* Main Analysis card details */}
              <TenderDetail
                tender={activeTender}
                onDelete={handleDeleteTender}
                onUpdateStatus={handleUpdateStatus}
                userId={session.user.id}
                userEmail={session.user.email || ''}
              />

              {/* Q&A Side panel chatbot */}
              <ChatBot
                tenderId={activeTender.id}
                documentText={activeTender.extracted_text}
                userId={session.user.id}
              />
            </div>
          )
        )}
      </main>

      {/* Workspace Settings / Team Management modal */}
      <WorkspaceSettingsModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        orgId={activeOrgId}
        orgName={orgs.find(o => o.id === activeOrgId)?.name || 'Active Workspace'}
        userId={session.user.id}
      />
    </div>
  );
}

export default App;
