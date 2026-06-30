import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

const FlaskIllustration = () => (
  <div className="flask-animate" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <path d="M26 12H38V22L50 44C53 49 49 54 44 54H20C15 54 11 49 14 44L26 22V12Z" stroke="var(--accent-gold)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M19 44C16 39 19 32 24 32C29 32 30 35 34 35C38 35 40 31 45 31C50 31 51 36 49 40C47 44 44 48 44 48H20C20 48 20 45 19 44Z" fill="var(--accent-teal)" opacity="0.7" />
      <circle cx="28" cy="24" r="2" fill="var(--accent-gold)" />
      <circle cx="34" cy="20" r="3" fill="var(--accent-gold)" />
      <circle cx="31" cy="16" r="1.5" fill="var(--accent-gold)" />
    </svg>
  </div>
);

function CandidateCard({ profile, index }) {
  const [showJson, setShowJson] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);
  const [expandedExps, setExpandedExps] = useState({});

  const toggleExp = (idx) => {
    setExpandedExps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getConfidenceBadgeColor = (score) => {
    if (score >= 0.8) return 'var(--accent-green)';
    if (score >= 0.5) return 'var(--accent-orange)';
    return 'var(--accent-red)';
  };

  const getSourceColor = (sourceId) => {
    const src = String(sourceId).toLowerCase();
    if (src.includes('csv')) return 'var(--source-csv)';
    if (src.includes('ats') || src.includes('json') && !src.includes('linkedin')) return 'var(--source-ats)';
    if (src.includes('github')) return 'var(--source-github)';
    if (src.includes('linkedin')) return 'var(--source-linkedin)';
    if (src.includes('pdf') || src.includes('docx') || src.includes('resume')) return 'var(--source-resume)';
    if (src.includes('notes') || src.includes('notes_sample') || src.includes('txt')) return 'var(--source-notes)';
    return 'var(--accent-gold)';
  };

  const getSkillColor = (confidence) => {
    const conf = confidence || 0.5;
    const hue = 38 + conf * (178 - 38);
    return `hsl(${hue}, 75%, 52%)`;
  };

  const formatRangeDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.toLowerCase() === 'present') return 'Present';
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthName = months[monthIdx] || parts[1];
    return `${monthName} ${parts[0]}`;
  };

  const email = profile.emails && profile.emails[0];
  const phone = profile.phones && profile.phones[0];

  return (
    <div 
      className="glass-panel alchemy-card" 
      style={{
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'rgba(255, 255, 255, 0.015)',
        animationDelay: `${index * 60}ms`,
        transition: 'var(--transition-smooth)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-glow-gold)';
        e.currentTarget.style.borderColor = 'var(--accent-gold)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--border-glass)';
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '22px', color: '#fff', margin: 0 }}>
            {profile.full_name || 'Unknown Candidate'}
          </h3>
          {profile.headline && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              💼 {profile.headline}
            </div>
          )}
        </div>
        
        {/* Confidence Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', width: '52px', height: '52px' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="26" cy="26" r="22" fill="none" stroke="var(--bg-tertiary)" strokeWidth="4" />
              <circle 
                cx="26" 
                cy="26" 
                r="22" 
                fill="none" 
                stroke={getConfidenceBadgeColor(profile.overall_confidence || 0)} 
                strokeWidth="4" 
                strokeDasharray="138.2" 
                strokeDashoffset={138.2 - ((profile.overall_confidence || 0) * 138.2)} 
                style={{
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
                  strokeLinecap: 'round'
                }}
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: '700',
              color: '#fff'
            }}>
              {Math.round((profile.overall_confidence || 0) * 100)}%
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '800', 
              color: getConfidenceBadgeColor(profile.overall_confidence || 0), 
              letterSpacing: '0.05em' 
            }}>
              {(profile.overall_confidence || 0) >= 0.85 ? 'REFINED' : ((profile.overall_confidence || 0) >= 0.5 ? 'STABLE' : 'UNSTABLE')}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Confidence</span>
          </div>
        </div>
      </div>

      {/* Contact Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {email && (
          <span style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
            ✉️ {email}
          </span>
        )}
        {phone && (
          <span style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
            📞 {phone}
          </span>
        )}
        {profile.links?.linkedin && (
          <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(20, 150, 150, 0.1)', border: '1px solid rgba(20, 150, 150, 0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--accent-teal)', textDecoration: 'none' }}>
            🔗 LinkedIn
          </a>
        )}
        {profile.links?.github && (
          <a href={profile.links.github} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--accent-gold)', textDecoration: 'none' }}>
            💻 GitHub
          </a>
        )}
        {profile.links?.portfolio && (
          <a href={profile.links.portfolio} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(20, 150, 150, 0.1)', border: '1px solid rgba(20, 150, 150, 0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--accent-teal)', textDecoration: 'none' }}>
            🌐 Portfolio
          </a>
        )}
      </div>

      {/* Skills Pills */}
      {profile.skills && profile.skills.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>SKILLS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {profile.skills.map((skill, sIdx) => {
              const skillColor = getSkillColor(skill.confidence);
              return (
                <div 
                  key={sIdx} 
                  style={{
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${skillColor}`,
                    borderRadius: '16px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'inline-block',
                    transition: 'var(--transition-smooth)',
                    cursor: 'default',
                    boxShadow: `0 0 4px ${skillColor}22`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.06)';
                    e.currentTarget.style.filter = 'brightness(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.filter = 'none';
                  }}
                >
                  {skill.name} <span style={{ opacity: 0.6, fontSize: '9px' }}>({Math.round((skill.confidence || 0.4) * 100)}%)</span>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '3px',
                    width: `${(skill.confidence || 0.4) * 100}%`,
                    background: skillColor
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Experience Timeline */}
      {profile.experience && profile.experience.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>EXPERIENCE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {profile.experience.map((exp, idx) => {
              const dates = `${formatRangeDate(exp.start)} – ${formatRangeDate(exp.end)}`;
              const isExpanded = expandedExps[idx];
              const displaySummary = exp.summary ? (isExpanded ? exp.summary : (exp.summary.length > 150 ? exp.summary.substring(0, 150) + '...' : exp.summary)) : '';
              return (
                <div key={idx} style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>
                      {exp.title || 'Role'} {exp.company && <span style={{ color: 'var(--accent-teal)', fontWeight: 'normal' }}>at {exp.company}</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dates}</div>
                  </div>
                  {exp.summary && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                      {displaySummary}
                      {exp.summary.length > 150 && (
                        <span 
                          onClick={() => toggleExp(idx)}
                          style={{ color: 'var(--accent-teal)', cursor: 'pointer', marginLeft: '6px', fontWeight: '600' }}
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Education Section */}
      {profile.education && profile.education.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>EDUCATION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {profile.education.map((edu, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px'
              }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>{edu.institution || 'School'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {edu.degree || 'Degree'}{edu.field ? `, ${edu.field}` : ''}
                </div>
                {edu.end_year && (
                  <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '4px' }}>Graduation: {edu.end_year}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provenance Section */}
      {profile.provenance && profile.provenance.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <div 
            onClick={() => setShowProvenance(!showProvenance)}
            style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {showProvenance ? '▼ Hide Source Provenance' : '▶ Show Source Provenance'}
          </div>
          {showProvenance && (
            <div style={{
              background: 'rgba(0,0,0,0.15)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              marginTop: '8px',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                Field Deduplication Traceability Map
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '10px' }}>
                <div>Target Field</div>
                <div>Resolved Source</div>
                <div>Merge Method</div>
              </div>
              {profile.provenance.map((prov, pIdx) => {
                const dotColor = getSourceColor(prov.source);
                return (
                  <div key={pIdx} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: '8px', 
                    borderBottom: '1px solid rgba(255,255,255,0.02)', 
                    padding: '6px 0', 
                    alignItems: 'center' 
                  }}>
                    <div style={{ fontWeight: '600', color: 'var(--accent-teal)' }}>{prov.field}</div>
                    <div>
                      <span style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--bg-secondary)',
                        border: `1px solid ${dotColor}`,
                        borderRadius: '12px',
                        padding: '2px 10px',
                        fontSize: '10px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        boxShadow: `0 0 6px ${dotColor}33`
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor }} />
                        {prov.source}
                      </span>
                    </div>
                    <div style={{ opacity: 0.6 }}>{prov.method}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Collapsible View Raw JSON */}
      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', marginTop: '4px' }}>
        <div 
          onClick={() => setShowJson(!showJson)}
          style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          {showJson ? '▼ Hide Raw Profile JSON' : '▶ View Raw Profile JSON'}
        </div>
        {showJson && (
          <pre style={{
            background: '#090807',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            padding: '16px',
            fontSize: '11px',
            color: 'var(--accent-gold)',
            overflow: 'auto',
            maxHeight: '300px',
            marginTop: '8px'
          }}>
            {JSON.stringify(profile, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Input fields
  const [files, setFiles] = useState([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [customConfig, setCustomConfig] = useState('');
  
  // Pipeline state
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [activeStageIdx, setActiveStageIdx] = useState(-1);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('run'); // 'run' | 'past-runs' | 'configs'

  // Past runs
  const [pastRuns, setPastRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [reprojecting, setReprojecting] = useState(false);

  // Saved configs list
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [newConfigName, setNewConfigName] = useState('');

  // DB Connection status
  const [dbStatus, setDbStatus] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const checkHealth = async () => {
    try {
      const res = await fetch(API_BASE + '/api/health');
      const data = await res.json();
      const connected = data.database?.status === 'connected';
      setDbStatus({ reachable: true, connected });
    } catch (err) {
      setDbStatus({ reachable: false, connected: false });
    }
  };

  // Reset banner dismissal state if connection status changes to degraded/unreachable
  useEffect(() => {
    if (dbStatus) {
      if (!dbStatus.reachable || !dbStatus.connected) {
        setBannerDismissed(false);
      }
    }
  }, [dbStatus?.connected, dbStatus?.reachable]);

  // Fetch initial data and setup status checking
  useEffect(() => {
    fetchPastRuns();
    fetchDefaultConfig();
    fetchSavedConfigs();
    checkHealth();

    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPastRuns = async () => {
    checkHealth();
    try {
      const res = await fetch(API_BASE + '/api/runs');
      if (res.ok) {
        const data = await res.json();
        setPastRuns(data);
      }
    } catch (e) {
      console.error('Failed to load past runs:', e);
    }
  };

  const fetchDefaultConfig = async () => {
    try {
      const res = await fetch(API_BASE + '/api/config/default');
      if (res.ok) {
        const data = await res.json();
        setCustomConfig(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error('Failed to load default config:', e);
    }
  };

  const fetchSavedConfigs = async () => {
    checkHealth();
    try {
      const res = await fetch(API_BASE + '/api/configs');
      if (res.ok) {
        const data = await res.json();
        setSavedConfigs(data);
      }
    } catch (e) {
      console.error('Failed to load saved configs:', e);
    }
  };

  // Set up loading stages animation
  useEffect(() => {
    let interval;
    if (loading) {
      const stages = [
        'Detecting source file formats...',
        'Extracting candidate profile records...',
        'Normalizing emails, phones, and dates...',
        'Merging duplicate profiles...',
        'Calculating field confidence scores...',
        'Applying custom projection configurations...',
        'Validating canonical output schemas...'
      ];
      let currentIdx = 0;
      setLoadingStage(stages[0]);
      setActiveStageIdx(0);
      interval = setInterval(() => {
        currentIdx = (currentIdx + 1) % stages.length;
        setLoadingStage(stages[currentIdx]);
        setActiveStageIdx(currentIdx);
      }, 800);
    } else {
      setLoadingStage('');
      setActiveStageIdx(-1);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const acceptedFiles = droppedFiles.filter(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        return ['csv', 'json', 'pdf', 'docx', 'txt'].includes(ext);
      });
      setFiles(prev => [...prev, ...acceptedFiles]);
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const handleRunPipeline = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setWarnings([]);

    try {
      const formData = new FormData();
      
      // Append files
      files.forEach(file => {
        formData.append('files', file);
      });

      // Append URLs
      if (githubUrl.trim()) formData.append('github_url', githubUrl.trim());
      if (linkedinUrl.trim()) formData.append('linkedin_url', linkedinUrl.trim());

      // Append config
      if (customConfig.trim()) {
        try {
          const parsed = JSON.parse(customConfig);
          formData.append('config', JSON.stringify(parsed));
        } catch (err) {
          setError({ message: 'Malformed JSON Config: ' + err.message });
          setLoading(false);
          return;
        }
      }

      const res = await fetch(API_BASE + '/api/pipeline/run', {
        method: 'POST',
        body: formData
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned invalid response format: ${text.substring(0, 150) || 'Empty body'}`);
      }

      if (!res.ok) {
        throw new Error(data.error?.message || 'Transformation pipeline failed.');
      }

      setResult(data.profiles);
      setWarnings(data.warnings || []);
      fetchPastRuns(); // refresh list
    } catch (err) {
      setError({ message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRun = async (runId) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setWarnings([]);
    try {
      const res = await fetch(API_BASE + `/api/runs/${runId}`);
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned invalid response format: ${text.substring(0, 150) || 'Empty body'}`);
      }

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to retrieve run details.');
      }
      setSelectedRun(data);
      // set output panel with canonical profiles or default project
      setResult(data.profiles);
      setWarnings(data.run.warnings || []);
    } catch (err) {
      setError({ message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReproject = async () => {
    if (!selectedRun) return;
    setReprojecting(true);
    setError(null);
    try {
      let configObj;
      try {
        configObj = JSON.parse(customConfig);
      } catch (err) {
        throw new Error('Malformed JSON Config: ' + err.message);
      }

      const res = await fetch(API_BASE + `/api/pipeline/project/${selectedRun.run._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config: configObj })
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned invalid response: ${text.substring(0, 150) || 'Empty body'}`);
      }
      if (!res.ok) {
        throw new Error(data.error?.message || 'Reprojection failed.');
      }

      setResult(data.profiles);
      setWarnings(data.warnings || []);
    } catch (err) {
      setError({ message: err.message });
    } finally {
      setReprojecting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!newConfigName.trim() || !customConfig.trim()) return;
    try {
      let configObj;
      try {
        configObj = JSON.parse(customConfig);
      } catch (err) {
        alert('Malformed JSON config: ' + err.message);
        return;
      }

      const res = await fetch(API_BASE + '/api/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newConfigName.trim(),
          config: configObj
        })
      });

      if (res.ok) {
        setNewConfigName('');
        fetchSavedConfigs();
        alert('Configuration saved successfully!');
      } else {
        const data = await res.json();
        alert('Failed to save config: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const loadSavedConfig = (cfgObj) => {
    setCustomConfig(JSON.stringify(cfgObj, null, 2));
  };

  return (
    <div className="container animate-fade-in">
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '36px', marginBottom: '8px' }}>
            Candidate Data <span className="gradient-text">Transformer</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Pure deterministic, traceable, multi-source deduplication pipeline.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${activeTab === 'run' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('run'); setSelectedRun(null); setResult(null); }}
          >
            ⚡ Run Pipeline
          </button>
          <button 
            className={`btn ${activeTab === 'past-runs' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('past-runs'); setResult(null); }}
          >
            🗂️ Past Runs ({pastRuns.length})
          </button>
          <button 
            className={`btn ${activeTab === 'configs' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('configs')}
          >
            ⚙️ Saved Configs
          </button>
        </div>
      </header>

      {/* Database connection/backend liveness status banners */}
      {dbStatus && !dbStatus.reachable && !bannerDismissed && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid #ef4444',
          color: '#f87171',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
          fontSize: '14px'
        }}>
          <div>
            <strong>⚠️ Cannot reach the backend server at all.</strong> Make sure <code>npm start</code> is running in <code>/server</code>.
          </div>
          <button 
            onClick={() => setBannerDismissed(true)}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      {dbStatus && dbStatus.reachable && !dbStatus.connected && !bannerDismissed && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid var(--accent-orange)',
          color: 'var(--accent-orange)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
          fontSize: '14px'
        }}>
          <div>
            <strong>⚠️ Database not connected:</strong> Run Pipeline still works, but run history and saved configs won't be persisted. Start MongoDB and refresh to enable these features.
          </div>
          <button 
            onClick={() => setBannerDismissed(true)}
            style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          <strong>Error:</strong> {error.message}
          {error.details && (
            <pre style={{ marginTop: '8px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
              {JSON.stringify(error.details, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="grid-cols-2">
        {/* LEFT COLUMN: Input Control Panel */}
        <div>
          {activeTab === 'run' && (
            <form onSubmit={handleRunPipeline} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Ingest Sources</h2>
              
              <div>
                <label>Upload Source Files (CSV, JSON, PDF, DOCX, TXT)</label>
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input').click()}
                  style={{
                    border: '2px dashed ' + (dragOver ? 'var(--accent-gold)' : 'var(--border-glass)'),
                    borderRadius: 'var(--radius-md)',
                    padding: '30px 20px',
                    textAlign: 'center',
                    background: dragOver ? 'var(--bg-glass-hover)' : 'var(--bg-glass)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)',
                    transform: dragOver ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: dragOver ? 'var(--shadow-glow-gold)' : 'none'
                  }}
                >
                  <input 
                    id="file-input"
                    type="file" 
                    multiple 
                    accept=".csv,.json,.pdf,.docx,.txt" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '28px', marginBottom: '8px', transition: 'transform 0.2s' }}>
                    {dragOver ? '🧪' : '📂'}
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                    Drag & drop files here, or <span style={{ color: 'var(--accent-gold)' }}>browse</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Supports CSV, JSON, PDF, DOCX, TXT
                  </div>
                </div>

                {files.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Staged Files ({files.length}):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                      {files.map((file, idx) => {
                        const ext = file.name.split('.').pop().toLowerCase();
                        let icon = '📄';
                        if (ext === 'pdf') icon = '📕';
                        if (ext === 'csv') icon = '📊';
                        if (ext === 'json') icon = '📦';
                        if (ext === 'docx') icon = '📘';
                        if (ext === 'txt') icon = '📝';
                        return (
                          <div 
                            key={idx}
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <span>{icon} {file.name}</span>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFile(idx);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                outline: 'none'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label>GitHub Username or Profile URL</label>
                <input 
                  type="text" 
                  placeholder="e.g. https://github.com/octocat" 
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
              </div>

              <div>
                <label>LinkedIn Profile URL (resolves to static mock fixture)</label>
                <input 
                  type="text" 
                  placeholder="e.g. https://linkedin.com/in/johndoe" 
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ margin: 0 }}>Runtime Output Projection Config (JSON)</label>
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '12px' }}
                    onClick={fetchDefaultConfig}
                  >
                    Reset to Default
                  </button>
                </div>
                <textarea 
                  value={customConfig}
                  onChange={(e) => setCustomConfig(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px', minHeight: '180px' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Processing...' : '🚀 Execute Transformation Pipeline'}
              </button>
            </form>
          )}

          {activeTab === 'past-runs' && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '20px' }}>Pipeline History</h2>
               {pastRuns.length === 0 ? (
                dbStatus && dbStatus.reachable && !dbStatus.connected ? (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '8px',
                    color: 'var(--accent-orange)',
                    fontSize: '13px',
                    lineHeight: '1.4'
                  }}>
                    <strong>⚠️ Database not connected:</strong> Run history cannot be loaded or saved. Please start MongoDB to enable pipeline history.
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No past runs yet — run the pipeline to see history here.</p>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
                  {pastRuns.map((run) => {
                    const dateStr = new Date(run.started_at).toLocaleString();
                    const isActive = selectedRun?.run?._id === run._id;
                    return (
                      <div 
                        key={run._id}
                        onClick={() => handleSelectRun(run._id)}
                        className="glass-panel"
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
                          borderColor: isActive ? 'var(--accent-blue)' : 'var(--border-glass)',
                          transform: isActive ? 'scale(1.01)' : 'scale(1)',
                          transition: 'var(--transition-smooth)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontWeight: '750', fontSize: '14px', color: 'var(--text-primary)' }}>
                            Run #{run._id.slice(-6).toUpperCase()}
                          </span>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '700',
                            padding: '3px 8px', 
                            borderRadius: '12px',
                            background: run.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: run.status === 'completed' ? 'var(--accent-green)' : '#f87171',
                            border: '1px solid ' + (run.status === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)')
                          }}>
                            {run.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '12px', color: 'var(--text-muted)', gap: '8px' }}>
                          <div>📥 Sources: <strong style={{ color: '#fff' }}>{run.source_count}</strong></div>
                          <div>👤 Profiles: <strong style={{ color: '#fff' }}>{run.profile_count}</strong></div>
                          <div style={{ gridColumn: 'span 2', fontSize: '11px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                            📅 {dateStr}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'configs' && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '20px' }}>Save & Choose Projection Configurations</h2>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Configuration Name"
                  value={newConfigName}
                  onChange={(e) => setNewConfigName(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleSaveConfig} style={{ flexShrink: 0 }}>
                  Save Current Config
                </button>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label>Saved Templates</label>
                {savedConfigs.length === 0 ? (
                  dbStatus && dbStatus.reachable && !dbStatus.connected ? (
                    <div style={{
                      padding: '16px',
                      background: 'rgba(245, 158, 11, 0.05)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: '8px',
                      color: 'var(--accent-orange)',
                      fontSize: '13px',
                      lineHeight: '1.4'
                    }}>
                      <strong>⚠️ Database not connected:</strong> Custom configurations cannot be loaded or saved. Please start MongoDB to enable configurations persistence.
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No saved configurations yet — create one above to see it here.</p>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {savedConfigs.map(cfg => (
                      <div 
                        key={cfg._id} 
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '8px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{cfg.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Fields: {cfg.config?.fields?.length || 0}
                          </div>
                        </div>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => loadSavedConfig(cfg.config)}
                        >
                          Load Template
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reprojection control if run is selected */}
          {selectedRun && (
            <div className="glass-panel" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--accent-cyan)' }}>Re-project Selected Run</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Re-apply a projection config on the cached Canonical Profiles for Run #{selectedRun.run._id.slice(-6)} without re-extracting from raw files.
              </p>
              <div>
                <label>Modify Config for Reprojection</label>
                <textarea 
                  value={customConfig}
                  onChange={(e) => setCustomConfig(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px', minHeight: '120px' }}
                />
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleReproject} 
                disabled={reprojecting}
                style={{ background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-purple))' }}
              >
                {reprojecting ? 'Re-projecting...' : '🔄 Re-Project Cache'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Output Preview & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {selectedRun && (
            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(34, 211, 238, 0.03)', borderColor: 'var(--accent-cyan)' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--accent-cyan)' }}>Active Selection: Run Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>ID: <strong style={{ color: '#fff' }}>{selectedRun.run._id}</strong></div>
                <div>Status: <strong style={{ color: 'var(--accent-green)' }}>{selectedRun.run.status}</strong></div>
                <div>Sources: <strong>{selectedRun.sources?.length || 0}</strong></div>
                <div>Profiles: <strong>{selectedRun.profiles?.length || 0}</strong></div>
              </div>
              
              {selectedRun.sources && selectedRun.sources.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ingested Files:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {selectedRun.sources.map(src => (
                      <span 
                        key={src._id}
                        style={{
                          background: 'var(--bg-tertiary)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-glass)'
                        }}
                      >
                        📄 {src.source_id} ({src.source_type})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px' }}>Transformation Output</h2>
              {loading && <span style={{ color: 'var(--accent-gold)', fontSize: '14px' }}>⚡ In progress...</span>}
            </div>

            {warnings.length > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid var(--accent-orange)',
                color: 'var(--accent-orange)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
              }}>
                <div style={{ fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Pipeline Warnings ({warnings.length})
                </div>
                <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {warnings.map((w, idx) => <li key={idx} style={{ opacity: 0.9 }}>{w}</li>)}
                </ul>
              </div>
            )}

            <div style={{ flexGrow: 1, position: 'relative', background: '#0a0908', borderRadius: '8px', border: '1px solid var(--border-glass)', minHeight: '400px' }}>
              {loading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-primary)',
                  flexDirection: 'column',
                  gap: '24px',
                  padding: '40px 20px',
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: '#0a0908',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontWeight: '750', fontSize: '18px', color: 'var(--accent-gold)' }}>
                    🔮 Transmuting Messy Data...
                  </div>
                  
                  {/* Stages List */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    width: '85%',
                    maxWidth: '340px',
                    textAlign: 'left',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-glass)'
                  }}>
                    {[
                      { label: 'Detecting Format', icon: '🔍' },
                      { label: 'Extracting Profiles', icon: '🧪' },
                      { label: 'Normalizing Data', icon: '⚖️' },
                      { label: 'Merging duplicates', icon: '🧬' },
                      { label: 'Scoring Confidence', icon: '🎯' },
                      { label: 'Projecting Output', icon: '🔮' },
                      { label: 'Validating Schema', icon: '✅' }
                    ].map((stage, idx) => {
                      const isActive = activeStageIdx === idx;
                      const isCompleted = activeStageIdx > idx;
                      return (
                        <div 
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            opacity: isActive ? 1 : (isCompleted ? 0.8 : 0.3),
                            transform: isActive ? 'scale(1.05)' : 'scale(1)',
                            transition: 'var(--transition-bounce)',
                            color: isActive ? 'var(--accent-gold)' : (isCompleted ? 'var(--accent-green)' : 'var(--text-muted)'),
                            fontWeight: isActive ? '700' : 'normal'
                          }}
                        >
                          <span style={{ fontSize: '16px' }}>
                            {isCompleted ? '✅' : stage.icon}
                          </span>
                          <span>{stage.label}</span>
                          {isActive && <span className="pulse-dot" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress Line */}
                  <div style={{ width: '80%', background: 'var(--bg-secondary)', height: '4px', borderRadius: '2px', overflow: 'hidden', marginTop: '10px' }}>
                    <div style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-teal))',
                      width: `${((activeStageIdx + 1) / 7) * 100}%`,
                      transition: 'width 0.4s ease-out'
                    }} />
                  </div>
                </div>
              ) : result ? (
                result.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0
                  }}>
                    <FlaskIllustration />
                    <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-gold)' }}>No Candidate Profiles Resolved</div>
                    <p style={{ fontSize: '12px', maxWidth: '300px' }}>
                      The ingested sources did not contain any valid candidate records or could not be successfully resolved.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    padding: '20px',
                    overflow: 'auto',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
                  }}>
                    {result.map((profile, idx) => (
                      <CandidateCard key={profile.candidate_id} profile={profile} index={idx} />
                    ))}
                  </div>
                )
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  <FlaskIllustration />
                  <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-gold)' }}>Ready to Refine Profiles</div>
                  <p style={{ fontSize: '12px', maxWidth: '300px' }}>
                    Upload messy files, input candidate URLs, and click the execute button to initiate candidate data alchemy.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
