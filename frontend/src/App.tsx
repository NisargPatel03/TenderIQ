import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import type { Tender } from './components/Sidebar';
import { UploadZone } from './components/UploadZone';
import { TenderDetail } from './components/TenderDetail';
import { ChatBot } from './components/ChatBot';
import { FolderOpen, FileCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [activeTenderId, setActiveTenderId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(true);

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

  const handleAuthSuccess = () => {
    // Session is updated automatically by listener
  };

  const handleUploadStart = () => {
    // Optional loader styling trigger
  };

  const handleUploadSuccess = async (result: any) => {
    if (!session?.user) return;

    try {
      // Insert the analysis results into the Supabase database
      const { data: newTender, error } = await supabase
        .from('tenders')
        .insert({
          user_id: session.user.id,
          name: result.name,
          file_size: result.file_size,
          page_count: result.page_count,
          extracted_text: result.extracted_text,
          analysis_result: result.analysis,
          deadline: result.analysis.deadline || null,
          status: 'Active'
        })
        .select()
        .single();

      if (error) throw error;

      // Reload tenders and set active
      setTenders((prev) => [newTender, ...prev]);
      setActiveTenderId(newTender.id);
      setShowUploadForm(false);

      // Trigger premium success confetti explosion
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#ffffff']
      });

    } catch (err) {
      console.error("Failed to save tender to database:", err);
      alert("AI analyzed successfully, but saving to your database failed. Please verify your Supabase schema.");
    }
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

  const handleUpdateStatus = async (id: string, status: 'Active' | 'Submitted' | 'Expired') => {
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
    <div className="app-container">
      {/* Sidebar List */}
      <Sidebar
        tenders={tenders}
        activeTenderId={activeTenderId}
        onSelectTender={(id) => {
          setActiveTenderId(id);
          setShowUploadForm(id === null);
        }}
        onDeleteTender={handleDeleteTender}
        onNewTenderClick={() => {
          setActiveTenderId(null);
          setShowUploadForm(true);
        }}
        userEmail={session.user.email || 'Guest User'}
      />

      {/* Main Workspace Frame */}
      <main className="main-workspace">
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
