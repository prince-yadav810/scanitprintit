'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Image, Trash2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) return <Image size={16} color="var(--accent)" />;
  return <FileText size={16} color="var(--text-secondary)" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ShopUploadUI({ shop }: { shop: any }) {
  const [files, setFiles]           = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [error, setError]           = useState('');

  const [printMode, setPrintMode]   = useState<'BW' | 'COLOR'>('BW');
  const [sides, setSides]           = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [copies, setCopies]         = useState(1);

  const bwTier    = shop.pricingTiers?.find((t: any) => t.mode === 'BW');
  const colorTier = shop.pricingTiers?.find((t: any) => t.mode === 'COLOR');
  const pricePerPage = printMode === 'BW' ? (bwTier?.pricePerPage ?? 5) : (colorTier?.pricePerPage ?? 10);
  const sideMultiplier = sides === 'DOUBLE' ? 0.6 : 1;

  const addFiles = (newFiles: FileList | File[]) => {
    setError('');
    setFiles(prev => [...prev, ...Array.from(newFiles)]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, []);

  const handleProcessFiles = async () => {
    if (!files.length) return;
    setIsProcessing(true);
    setError('');

    const uploadedFiles = [];
    for (const file of files) {
      setProcessingLabel(`Uploading ${file.name}…`);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res  = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          uploadedFiles.push({ originalName: file.name, cloudinaryUrl: data.url, pages: data.pages || 1, resourceType: data.resourceType });
        } else {
          setError(`${file.name}: ${data.error}`);
          setIsProcessing(false);
          return;
        }
      } catch {
        setError(`Network error uploading ${file.name}`);
        setIsProcessing(false);
        return;
      }
    }

    setProcessingLabel('Creating order…');
    try {
      const res  = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: shop.id, files: uploadedFiles, printMode, sides, copies }),
      });
      const data = await res.json();
      if (data.success) window.location.href = `/o/${data.orderId}`;
      else { setError(data.error || 'Failed to create order'); setIsProcessing(false); }
    } catch {
      setError('Network error. Please try again.');
      setIsProcessing(false);
    }
  };

  const totalPages = files.length > 0 ? '…' : '0';
  const hasFiles   = files.length > 0;

  return (
    <div className="page" style={{ paddingBottom: hasFiles ? 96 : 0 }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
        <div className="container-sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="font-semibold" style={{ fontSize: '0.95rem' }}>{shop.name}</div>
              <div className="text-xs text-muted">Instant printing service</div>
            </div>
            <div className="badge badge-green">Open</div>
          </div>
        </div>
      </div>

      <div className="container-sm" style={{ paddingTop: 28, paddingBottom: 24 }}>
        {/* Drop Zone */}
        <div className="fade-up">
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={22} color="var(--text-secondary)" />
            </div>
            <div>
              <p className="font-medium" style={{ fontSize: '0.95rem' }}>Tap to select files</p>
              <p className="text-sm text-muted mt-2">PDF, DOCX, PPTX, JPG, PNG — up to 50 MB</p>
            </div>
            <input type="file" id="fileInput" multiple accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mt-4" style={{ color: 'var(--danger)', fontSize: '0.875rem', padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)' }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* File List */}
        {hasFiles && (
          <div className="fade-up delay-1" style={{ marginTop: 24 }}>
            <div className="section-title">{files.length} {files.length === 1 ? 'File' : 'Files'} selected</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map((file, idx) => (
                <div key={idx} className="file-item">
                  {getFileIcon(file)}
                  <span className="file-item-name">{file.name}</span>
                  <span className="file-item-meta">{formatBytes(file.size)}</span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '4px', color: 'var(--text-placeholder)' }}
                    onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, i) => i !== idx)); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Print Settings */}
            <div className="card" style={{ marginTop: 24 }}>
              <div className="section-title">Print Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="field">
                  <label className="label">Color Mode</label>
                  <div className="segment">
                    <button className={`segment-btn ${printMode === 'BW' ? 'active' : ''}`} onClick={() => setPrintMode('BW')}>
                      B&W — ₹{bwTier?.pricePerPage ?? 5}/pg
                    </button>
                    <button className={`segment-btn ${printMode === 'COLOR' ? 'active' : ''}`} onClick={() => setPrintMode('COLOR')}>
                      Color — ₹{colorTier?.pricePerPage ?? 10}/pg
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label className="label">Layout</label>
                  <div className="segment">
                    <button className={`segment-btn ${sides === 'SINGLE' ? 'active' : ''}`} onClick={() => setSides('SINGLE')}>Single-sided</button>
                    <button className={`segment-btn ${sides === 'DOUBLE' ? 'active' : ''}`} onClick={() => setSides('DOUBLE')}>Double-sided</button>
                  </div>
                </div>

                <div className="field">
                  <label className="label">Copies</label>
                  <div className="counter">
                    <button className="counter-btn" onClick={() => setCopies(Math.max(1, copies - 1))}>−</button>
                    <span className="counter-value">{copies}</span>
                    <button className="counter-btn" onClick={() => setCopies(copies + 1)}>+</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky price bar */}
      {hasFiles && (
        <div className="price-bar">
          <div className="price-bar-inner">
            <div>
              <div className="price-amount">₹{(pricePerPage * sideMultiplier * copies).toFixed(2)}<span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/page</span></div>
              <div className="price-label">{copies} cop{copies === 1 ? 'y' : 'ies'} · {sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided'}</div>
            </div>
            <button
              className="btn btn-primary btn-xl"
              style={{ flex: 1, maxWidth: 200 }}
              disabled={isProcessing}
              onClick={handleProcessFiles}
            >
              {isProcessing ? <><Loader2 size={15} className="spin" /> {processingLabel}</> : <>Continue <ChevronRight size={15} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
