import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { X, UserPlus, Shield, Trash2, Mail, Users, ArrowRight } from 'lucide-react';
import { useNotification } from './NotificationProvider';

interface Member {
  id: string;
  user_email: string;
  role: string;
  user_id: string;
}

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string | null;
  orgName: string;
  userId: string;
}

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  orgId,
  orgName,
  userId,
}) => {
  const { showToast, showConfirm } = useNotification();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Legal Auditor' | 'Technical Reviewer' | 'Bid Manager'>('Bid Manager');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orgId) {
      fetchMembers();
    }
  }, [isOpen, orgId]);

  const fetchMembers = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Get all members of the organization
      const { data, error } = await supabase
        .from('org_members')
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;
      setMembers(data || []);

      // Check current user's role
      const userMember = data?.find(m => m.user_id === userId);
      if (userMember) {
        setCurrentUserRole(userMember.role);
      } else {
        // If not found in members but owner of the org
        const { data: orgData } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', orgId)
          .single();
        if (orgData?.owner_id === userId) {
          setCurrentUserRole('Owner');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load team members.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setLoading(true);
    try {
      // Check if user is already a member
      if (members.some(m => m.user_email === email)) {
        throw new Error('User is already a member of this workspace.');
      }

      // Call custom RPC function to search for user id by email
      const { data: targetUserId, error: rpcError } = await supabase.rpc(
        'get_user_id_by_email',
        { email_addr: email }
      );

      if (rpcError) throw rpcError;
      if (!targetUserId) {
        throw new Error('User with this email is not registered on TenderIQ yet.');
      }

      // Insert into org_members
      const { error: insertError } = await supabase
        .from('org_members')
        .insert({
          org_id: orgId,
          user_id: targetUserId,
          user_email: email,
          role: inviteRole,
        });

      if (insertError) throw insertError;

      showToast(`Successfully added ${email} to workspace!`, 'success');
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      showToast(err.message || 'Invitation failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberEmail: string) => {
    showConfirm({
      title: 'Remove Team Member',
      message: `Are you sure you want to remove ${memberEmail} from this workspace?`,
      confirmText: 'Remove',
      isDanger: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('org_members')
            .delete()
            .eq('id', memberId);

          if (error) throw error;
          showToast('Team member removed successfully.', 'success');
          fetchMembers();
        } catch (err: any) {
          showToast(err.message || 'Failed to remove member.', 'error');
        }
      }
    });
  };

  if (!isOpen) return null;

  const isOwnerOrAdmin = currentUserRole === 'Owner' || currentUserRole === 'Admin';

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div className="modal-content glass" style={{
        width: '100%',
        maxWidth: '560px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: 'var(--shadow-glow)',
        color: '#ffffff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} className="text-primary" style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '18px' }}>Workspace: {orgName}</h3>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Invite Form */}
        {isOwnerOrAdmin ? (
          <form onSubmit={handleInvite} style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <h4 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={14} style={{ color: 'var(--primary)' }} /> Invite Colleague
            </h4>
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="form-control"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    paddingLeft: '36px',
                    width: '100%',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '8px',
                    fontSize: '13px'
                  }}
                >
                  <option value="Bid Manager">Bid Manager (Edit/Delete)</option>
                  <option value="Legal Auditor">Legal Auditor (Auditing only)</option>
                  <option value="Technical Reviewer">Technical Reviewer (Review only)</option>
                  <option value="Admin">Admin (Full Workspace Management)</option>
                </select>

                <button type="submit" className="btn btn-primary" style={{ paddingLeft: '16px', paddingRight: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }} disabled={loading}>
                  Invite <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '1px solid var(--border-light)'
          }}>
            Only Workspace Owners and Admins can invite team members.
          </div>
        )}

        {/* Member list */}
        <div>
          <h4 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} /> Team Members ({members.length})
          </h4>

          {loading && members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading members...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {members.map((m) => (
                <div key={m.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{m.user_email}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Shield size={10} style={{ color: m.role === 'Owner' || m.role === 'Admin' ? 'var(--primary)' : 'var(--text-muted)' }} /> {m.role}
                    </span>
                  </div>

                  {isOwnerOrAdmin && m.user_id !== userId && m.role !== 'Owner' && (
                    <button
                      onClick={() => handleRemoveMember(m.id, m.user_email)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      className="delete-member-btn"
                    >
                      <Trash2 size={14} hover-color="var(--accent-red)" style={{ transition: 'color 0.2s' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .delete-member-btn:hover {
          color: var(--accent-red) !important;
        }
      `}</style>
    </div>
  );
};
