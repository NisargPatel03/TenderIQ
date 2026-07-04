import React, { useState } from 'react';
import { Compass, CheckCircle2, XCircle, AlertCircle, Sparkles } from 'lucide-react';

interface GoNoGoScorecardProps {
  tender: {
    id: string;
    name: string;
    analysis_result: any;
  };
}

export const GoNoGoScorecard: React.FC<GoNoGoScorecardProps> = ({ tender }) => {
  const [profileText, setProfileText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!profileText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/gonogo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis_result: tender.analysis_result,
          company_profile: profileText.trim()
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to evaluate suitability scorecard.");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during evaluation.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreClass = (score: number) => {
    if (score >= 75) return 'score-high';
    if (score >= 50) return 'score-med';
    return 'score-low';
  };

  return (
    <div className="scorecard-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Compass size={20} style={{ color: 'var(--primary)' }} />
        <h2 style={{ fontSize: '18px' }}>Bidding Go-NoGo Suitability Scorecard</h2>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        Paste your company profile details below (e.g. annual turnover, standard certifications, work experience, team size). 
        The AI Bidding Consultant will audit your metrics against the tender's eligibility, financial requirements, and scope of work to output a GAP analysis.
      </p>

      {!result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <textarea
            className="text-area"
            placeholder="Example: Our company has 5 years of software development experience. Our annual turnover is $2.5 Million. We hold ISO 9001 and ISO 27001 certificates. We have built 3 large web platforms previously for municipal councils. We can support a bid security of up to $20,000..."
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            disabled={loading}
            style={{ minHeight: '120px' }}
          />

          {error && (
            <div style={{ fontSize: '13px', color: 'var(--accent-red)', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleEvaluate}
            disabled={loading || !profileText.trim()}
            style={{ width: 'fit-content', padding: '10px 20px', height: '40px', justifyContent: 'center' }}
          >
            {loading ? (
              <span className="loading-dots">
                Evaluating Suitability<span></span><span></span><span></span>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} /> Calculate Compatibility Score
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="scorecard-workspace">
          {/* Radial meter */}
          <div className="score-radial">
            <div className={`radial-circle ${getScoreClass(result.score)}`}>
              {result.score}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>TenderIQ Decision</span>
              <span className={`decision-tag`} style={{
                background: result.decision === 'Go' ? 'rgba(16, 185, 129, 0.15)' : result.decision === 'No-Go' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: result.decision === 'Go' ? 'var(--primary)' : result.decision === 'No-Go' ? 'var(--accent-red)' : 'var(--accent-gold)',
                border: '1px solid ' + (result.decision === 'Go' ? 'rgba(16, 185, 129, 0.3)' : result.decision === 'No-Go' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)')
              }}>
                {result.decision}
              </span>
            </div>
          </div>

          {/* Details column */}
          <div className="scorecard-details">
            <div className="scorecard-explanation">
              {result.explanation}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div className="gonogo-list-title">
                  <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />
                  <span>Matching Strengths</span>
                </div>
                <ul className="gonogo-list matches">
                  {result.matches?.map((m: string, i: number) => (
                    <li key={i}>{m}</li>
                  ))}
                  {(!result.matches || result.matches.length === 0) && (
                    <li style={{ color: 'var(--text-muted)' }}>No notable matches identified.</li>
                  )}
                </ul>
              </div>

              <div>
                <div className="gonogo-list-title">
                  <XCircle size={16} style={{ color: 'var(--accent-red)' }} />
                  <span>Identified Gaps & Risks</span>
                </div>
                <ul className="gonogo-list gaps">
                  {result.gaps?.map((g: string, i: number) => (
                    <li key={i}>{g}</li>
                  ))}
                  {(!result.gaps || result.gaps.length === 0) && (
                    <li style={{ color: 'var(--text-muted)' }}>No significant gaps identified.</li>
                  )}
                </ul>
              </div>
            </div>

            <button 
              className="btn" 
              onClick={() => {
                setResult(null);
                setProfileText('');
              }}
              style={{ width: 'fit-content', marginTop: '12px' }}
            >
              Run New Evaluation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
