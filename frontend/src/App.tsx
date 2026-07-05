import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import type { Tender } from './components/Sidebar';
import { UploadZone } from './components/UploadZone';
import { TenderDetail } from './components/TenderDetail';
import { ChatBot } from './components/ChatBot';
import { FolderOpen, FileCheck, Sparkles, CheckCircle2, Menu, X } from 'lucide-react';
import confetti from 'canvas-confetti';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [activeTenderId, setActiveTenderId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // 2. Fetch Tenders list from Supabase
  const fetchTenders = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);
    } catch (err) {
      console.error("Error fetching tenders:", err);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchTenders();
    }
  }, [session]);

  // 3. Poll status of 'Processing' tenders every 3s — works because Render
  //    runs background tasks to completion (no serverless kill).
  useEffect(() => {
    const processingTenders = tenders.filter(t => t.status === 'Processing');
    if (processingTenders.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const { data: freshList, error } = await supabase
          .from('tenders')
          .select('*')
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
  }, [tenders, activeTenderId]);

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
      />

      {/* Main Workspace Frame */}
      <main className={`main-workspace ${activeTender ? 'workspace-active' : ''}`}>
        {showUploadForm ? (
          /* Upload Dashboard screen */
          <>
            <div className="header">
              <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                Procurement Intelligence Center
              </h2>
            </div>

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
              />
            </div>
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
    </div>
  );
}

export default App;
