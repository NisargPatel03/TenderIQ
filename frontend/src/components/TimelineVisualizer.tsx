import React from 'react';
import { Calendar, Info, Clock } from 'lucide-react';

interface TimelineEvent {
  event: string;
  date: string;
}

interface TimelineVisualizerProps {
  timelineData: TimelineEvent[];
  additionalInfo?: string[];
}

export const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({ 
  timelineData,
  additionalInfo = [] 
}) => {
  
  if (!timelineData || timelineData.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--border-radius)',
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        <Calendar size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ marginBottom: '8px' }}>No timeline milestones found</h3>
        <p style={{ fontSize: '13px' }}>The AI Engine did not extract any key dates or deadlines from this document.</p>
      </div>
    );
  }

  // Parse and sort dates if possible, otherwise keep extracted order
  const sortedTimeline = [...timelineData].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (isNaN(dateA) || isNaN(dateB)) return 0; // fall back to original order if unparsable
    return dateA - dateB;
  });

  const isFuture = (dateStr: string) => {
    const timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) return true; // Treat as active if unparsable
    return timestamp > new Date().getTime();
  };

  return (
    <div className="timeline-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Clock size={20} style={{ color: 'var(--primary)' }} />
        <h2 style={{ fontSize: '18px' }}>Milestones & Timeline Roadmap</h2>
      </div>

      <div className="timeline-wrapper">
        {sortedTimeline.map((item, index) => {
          const active = isFuture(item.date);
          return (
            <div key={index} className={`timeline-item ${active ? 'future' : ''}`}>
              <div className="timeline-dot"></div>
              <div className="timeline-date">{item.date}</div>
              <div className="timeline-event">{item.event}</div>
            </div>
          );
        })}
      </div>

      {additionalInfo && additionalInfo.length > 0 && (
        <div style={{ 
          marginTop: '32px', 
          background: 'rgba(59, 130, 246, 0.05)', 
          border: '1px solid rgba(59, 130, 246, 0.15)',
          padding: '16px',
          borderRadius: '8px',
          display: 'flex',
          gap: '12px',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          <Info size={16} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '6px' }}>Additional Timeline Information:</strong>
            <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {additionalInfo.map((info, idx) => (
                <li key={idx}>{info}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
