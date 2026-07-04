import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Clipboard, AlertTriangle } from 'lucide-react';

interface UploadZoneProps {
  onUploadStart: () => void;
  onUploadSuccess: (result: any) => void;
  onUploadError: (err: string) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onUploadStart,
  onUploadSuccess,
  onUploadError,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [showTextPaste, setShowTextPaste] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setLocalError(null);
    const validExtensions = ['pdf', 'docx', 'txt'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      setLocalError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
      return;
    }
    setFile(selectedFile);
    setRawText(''); // Reset pasted text if file is chosen
  };

  const triggerUpload = async () => {
    if (!file && !rawText.trim()) {
      setLocalError("Please select a file or paste raw text first.");
      return;
    }

    setLocalError(null);
    setIsProcessing(true);
    onUploadStart();
    setProgress(15);
    setStatusText("Reading document content...");

    const formData = new FormData();
    if (file) {
      formData.append("file", file);
    } else {
      formData.append("raw_text", rawText.trim());
      formData.append("filename", "Pasted_Tender_Text.txt");
    }

    try {
      // Simulate reading file progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 800);

      setStatusText("Sending to TenderIQ AI Engine for multi-section parsing...");
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process document.");
      }

      setProgress(100);
      setStatusText("Analysis completed successfully!");
      const data = await response.json();
      
      setTimeout(() => {
        onUploadSuccess(data);
        resetState();
      }, 500);

    } catch (err: any) {
      const msg = err.message || "An error occurred during analysis.";
      setLocalError(msg);
      onUploadError(msg);
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setRawText('');
    setProgress(0);
    setStatusText('');
    setIsProcessing(false);
  };

  const getFriendlySize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="upload-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={{ fontSize: '20px' }}>Upload Tender Document</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Select or drop a tender RFP document. TenderIQ supports files up to 500 pages.
        </p>
      </div>

      {localError && (
        <div style={{
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid rgba(239, 68, 68, 0.2)', 
          padding: '12px', 
          borderRadius: '8px', 
          color: '#ef4444',
          fontSize: '13px'
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{localError}</span>
        </div>
      )}

      {!isProcessing ? (
        <>
          <div
            className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt"
            />
            <UploadCloud size={48} className="upload-icon" />
            <p style={{ fontWeight: 600, fontSize: '14px' }}>
              Drag and drop your file here, or <span style={{ color: 'var(--primary)' }}>browse</span>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Supports PDF, DOCX, TXT
            </p>
          </div>

          {file && (
            <div style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              background: 'var(--bg-secondary)', 
              padding: '12px 16px', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} style={{ color: 'var(--secondary)' }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>{file.name}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{getFriendlySize(file.size)}</p>
                </div>
              </div>
              <button 
                className="btn btn-danger" 
                style={{ padding: '4px 8px', fontSize: '11px' }}
                onClick={() => setFile(null)}
              >
                Clear
              </button>
            </div>
          )}

          <div className="raw-text-section">
            <button
              onClick={() => {
                setShowTextPaste(!showTextPaste);
                setFile(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: 'fit-content'
              }}
            >
              <Clipboard size={14} />
              {showTextPaste ? 'Hide text pasting area' : 'Or paste raw tender text instead'}
            </button>

            {showTextPaste && (
              <textarea
                className="text-area"
                placeholder="Paste the full text of your tender document here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={triggerUpload}
            style={{ width: '100%', padding: '12px', fontSize: '14px', height: '48px', justifyContent: 'center' }}
            disabled={!file && !rawText.trim()}
          >
            Start AI Auto-Extraction
          </button>
        </>
      ) : (
        <div className="progress-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
            <span>{statusText}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar-wrapper">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Large documents (100+ pages) may take up to 20-30 seconds to parse and structure.
          </p>
        </div>
      )}
    </div>
  );
};
