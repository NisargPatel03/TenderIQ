import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { Search, Plus, LogOut, Trash2, Calendar, FileType } from 'lucide-react';
import tenderiqLogo from '../assets/tenderiq_logo.png';

export interface Tender {
  id: string;
  name: string;
  status: 'Active' | 'Submitted' | 'Expired';
  deadline: string | null;
  file_size: number;
  page_count: number | null;
  analysis_result: any;
  extracted_text: string;
  created_at: string;
}

interface SidebarProps {
  tenders: Tender[];
  activeTenderId: string | null;
  onSelectTender: (id: string | null) => void;
  onDeleteTender: (id: string) => void;
  onNewTenderClick: () => void;
  userEmail: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  tenders,
  activeTenderId,
  onSelectTender,
  onDeleteTender,
  onNewTenderClick,
  userEmail,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out of TenderIQ?")) {
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  const filteredTenders = tenders.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getFriendlySize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={tenderiqLogo} alt="TenderIQ Logo" style={{ width: '32px', height: '32px', borderRadius: '6px', boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }} />
          <span className="logo-text" style={{ fontSize: '20px' }}>TenderIQ</span>
        </div>

        <button className="btn btn-primary" onClick={onNewTenderClick} style={{ width: '100%' }}>
          <Plus size={16} /> Analyze New Tender
        </button>

        <div className="search-bar">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search tenders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['All', 'Active', 'Submitted', 'Expired'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                background: filterStatus === status ? 'var(--bg-tertiary)' : 'transparent',
                border: '1px solid ' + (filterStatus === status ? 'var(--border-light)' : 'transparent'),
                color: filterStatus === status ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all var(--transition-speed)'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-content">
        {filteredTenders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No tenders found
          </div>
        ) : (
          filteredTenders.map((tender) => (
            <div
              key={tender.id}
              className={`tender-item ${activeTenderId === tender.id ? 'active' : ''}`}
              onClick={() => onSelectTender(tender.id)}
            >
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span className="tender-title" title={tender.name}>{tender.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${tender.name}"?`)) {
                      onDeleteTender(tender.id);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    opacity: activeTenderId === tender.id ? 1 : 0,
                    transition: 'opacity var(--transition-speed)',
                  }}
                  className="delete-item-btn"
                >
                  <Trash2 size={13} hover-color="var(--accent-red)" />
                </button>
              </div>

              <div className="tender-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileType size={12} /> {getFriendlySize(tender.file_size)}
                </span>
                <span className={`status-badge status-${tender.status.toLowerCase()}`}>
                  {tender.status}
                </span>
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={10} /> {new Date(tender.created_at).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-email">{userEmail}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Enterprise Workspace</span>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign Out">
          <LogOut size={16} />
        </button>
      </div>
      
      {/* Injecting CSS to hover-show trash can */}
      <style>{`
        .tender-item:hover .delete-item-btn {
          opacity: 1 !important;
        }
        .delete-item-btn:hover {
          color: var(--accent-red) !important;
        }
      `}</style>
    </aside>
  );
};
