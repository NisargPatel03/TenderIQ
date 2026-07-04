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
  const [files, setFiles] = useState<File[]>([]);
  const [rawText, setRawText] = useState('');
  const [showTextPaste, setShowTextPaste] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Helper to recursively extract files from folders dropped or uploaded
  const traverseAndAddItems = async (items: DataTransferItemList | DataTransferItem[]) => {
    setLocalError(null);
    const validExtensions = ['pdf', 'docx', 'txt'];
    const extractedFiles: File[] = [];
    let hasInvalid = false;

    const traverseEntry = (entry: any): Promise<void> => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          entry.file((file: File) => {
            const fileExtension = file.name.split('.').pop()?.toLowerCase();
            if (fileExtension && validExtensions.includes(fileExtension)) {
              extractedFiles.push(file);
            } else {
              hasInvalid = true;
            }
            resolve();
          }, () => resolve());
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const readAllEntries = (): Promise<void> => {
            return new Promise((resolveRead) => {
              dirReader.readEntries(async (entries: any[]) => {
                if (entries.length === 0) {
                  resolveRead();
                } else {
                  const promises = entries.map(ent => traverseEntry(ent));
                  await Promise.all(promises);
                  await readAllEntries();
                  resolveRead();
                }
              }, () => resolveRead());
            });
          };
          readAllEntries().then(() => resolve());
        } else {
          resolve();
        }
      });
    };

    const entryPromises = Array.from(items).map((item) => {
      if (typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          return traverseEntry(entry);
        }
      }
      const file = item.getAsFile();
      if (file) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (fileExtension && validExtensions.includes(fileExtension)) {
          extractedFiles.push(file);
        } else {
          hasInvalid = true;
        }
      }
      return Promise.resolve();
    });

    await Promise.all(entryPromises);

    if (hasInvalid) {
      setLocalError("Some files/folders were skipped. Only PDF, DOCX, or TXT formats are allowed.");
    }

    if (extractedFiles.length > 0) {
      setFiles((prev) => {
        const updated = [...prev];
        extractedFiles.forEach((file) => {
          if (!updated.some(f => f.name === file.name)) {
            updated.push(file);
          }
        });
        return updated;
      });
      setRawText('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      traverseAndAddItems(e.dataTransfer.items);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFiles(Array.from(e.target.files));
    }
  };

  const validateAndSetFiles = (selectedFiles: File[]) => {
    setLocalError(null);
    const validExtensions = ['pdf', 'docx', 'txt'];
    const validFiles: File[] = [];
    let hasInvalid = false;

    selectedFiles.forEach((selectedFile) => {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileExtension && validExtensions.includes(fileExtension)) {
        if (!files.some(f => f.name === selectedFile.name)) {
          validFiles.push(selectedFile);
        }
      } else {
        hasInvalid = true;
      }
    });

    if (hasInvalid) {
      setLocalError("Some files were skipped. Only PDF, DOCX, or TXT formats are allowed.");
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      setRawText(''); // Reset pasted text if files are chosen
    }
  };

  const triggerUpload = async () => {
    if (files.length === 0 && !rawText.trim()) {
      setLocalError("Please select at least one file or paste raw text first.");
      return;
    }

    setLocalError(null);
    setIsProcessing(true);
    onUploadStart();
    setProgress(15);
    setStatusText("Reading document content...");

    const formData = new FormData();
    if (files.length > 0) {
      files.forEach((f) => {
        formData.append("files", f);
      });
    } else {
      formData.append("raw_text", rawText.trim());
      formData.append("filename", "Pasted_Tender_Text.txt");
    }

    try {
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
    setFiles([]);
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
        <h2 style={{ fontSize: '20px' }}>Upload Bidding Documents</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Select or drag-and-drop multiple tender RFP files to analyze them as a unified bidding package.
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
              multiple
            />
            <input
              ref={folderInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              {...({
                webkitdirectory: "",
                directory: ""
              } as any)}
              multiple
            />
            <UploadCloud size={48} className="upload-icon" />
            <p style={{ fontWeight: 600, fontSize: '14px', lineHeight: '1.6' }}>
              Drag and drop files/folders here, or{' '}
              <span 
                style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                browse files
              </span>{' '}
              or{' '}
              <span 
                style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
              >
                browse folder
              </span>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Supports multiple PDF, DOCX, TXT files or entire directories
            </p>
          </div>

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Selected Files ({files.length})
                </span>
                <button 
                  style={{ fontSize: '11px', color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => setFiles([])}
                >
                  Clear All
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {files.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    background: 'var(--bg-secondary)', 
                    padding: '8px 12px', 
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={16} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>{f.name}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{getFriendlySize(f.size)}</p>
                      </div>
                    </div>
                    <button 
                      style={{ 
                        padding: '2px 6px', 
                        fontSize: '10px', 
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                        color: '#ef4444', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer' 
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="raw-text-section">
            <button
              onClick={() => {
                setShowTextPaste(!showTextPaste);
                setFiles([]);
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
            disabled={files.length === 0 && !rawText.trim()}
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
