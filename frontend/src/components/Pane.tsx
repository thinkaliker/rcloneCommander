import React, { useState, useEffect } from 'react';
import type { RcloneFile } from '../types';

interface PaneProps {
    title: string;
    remotes: string[];
    activeRemote: string;
    activePath: string;
    setActiveRemote: (val: string) => void;
    setActivePath: (val: string) => void;
    files: RcloneFile[];
    selectedFiles: Set<string>;
    toggleFile: (fileName: string) => void;
    toggleAll?: (fileNames: string[], selectAll: boolean) => void;
    isLoading: boolean;
    onDropFile?: (source: any, dest: any) => void;
    onRefresh: () => void;
    autoRefreshVal: number;
    setAutoRefreshVal: (val: number) => void;
}

export const Pane: React.FC<PaneProps> = ({
    title,
    remotes,
    activeRemote,
    activePath,
    setActiveRemote,
    setActivePath,
    files,
    selectedFiles,
    toggleFile,
    toggleAll,
    isLoading,
    onDropFile,
    onRefresh,
    autoRefreshVal,
    setAutoRefreshVal
}) => {
    const [pathInput, setPathInput] = useState(activePath);
    const [isDragOver, setIsDragOver] = useState(false);

    useEffect(() => {
        setPathInput(activePath);
    }, [activePath]);

    const handlePathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setActivePath(pathInput);
        }
    };

    const handleNavigate = (file: RcloneFile) => {
        if (!file.IsDir) return;
        let newPath = '';
        if (activeRemote === 'Local Filesystem') {
            const base = activePath || '/';
            newPath = base.endsWith('/') ? `${base}${file.Name}` : `${base}/${file.Name}`;
        } else {
            if (activePath === '' || activePath === '/') {
                newPath = file.Name;
            } else if (activePath.endsWith('/')) {
                newPath = `${activePath}${file.Name}`;
            } else {
                newPath = `${activePath}/${file.Name}`;
            }
        }
        setActivePath(newPath);
    };

    const goUpdir = () => {
        if (activePath === '' || activePath === '/') return;
        const parts = activePath.split('/');
        parts.pop();
        let newPath = parts.join('/');
        if (activeRemote === 'Local Filesystem' && newPath === '') {
            newPath = '/';
        }
        setActivePath(newPath);
    };

    const handleDragStart = (e: React.DragEvent, file: RcloneFile) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            sourceRemote: activeRemote,
            sourcePath: activePath,
            fileName: file.Name,
            isDir: file.IsDir
        }));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const dataStr = e.dataTransfer.getData('application/json');
        if (dataStr) {
            const data = JSON.parse(dataStr);
            if (data.sourceRemote !== activeRemote || data.sourcePath !== activePath) {
                if (onDropFile) {
                    onDropFile(data, { destRemote: activeRemote, destPath: activePath });
                }
            }
        }
    };

    return (
        <div
            className="pane"
            style={{ border: isDragOver ? '2px dashed var(--accent)' : '' }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
        >
            <div className="pane-header">
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-light)' }}>{title}</h3>
                <select
                    className="remotes-dropdown"
                    value={activeRemote}
                    onChange={(e) => setActiveRemote(e.target.value)}
                >
                    {remotes.map(remote => (
                        <option key={remote} value={remote}>{remote}</option>
                    ))}
                </select>
                <input
                    className="path-input"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={handlePathSubmit}
                    placeholder="Path... (Press Enter to navigate)"
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 8px', fontSize: '0.85rem', color: '#ccc' }}>
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={onRefresh}>⟳ Refresh</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label>Auto-refresh (s):</label>
                    <input
                        type="number"
                        min="0"
                        style={{ width: '45px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '2px 4px', fontSize: '0.8rem' }}
                        value={autoRefreshVal}
                        onChange={(e) => setAutoRefreshVal(parseInt(e.target.value) || 0)}
                    />
                </div>
            </div>

            <div className="file-list-container">
                {isLoading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading...</div>
                ) : (
                    <div>
                        <div className="file-item select-all-row" style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                            <input
                                type="checkbox"
                                className="file-checkbox"
                                checked={files.length > 0 && files.every(f => selectedFiles.has(f.Name))}
                                onChange={(e) => {
                                    if (toggleAll) toggleAll(files.map(f => f.Name), e.target.checked);
                                }}
                            />
                            <div className="file-name" style={{ marginLeft: '10px', fontWeight: 'bold' }}>Select All ({files.length} items)</div>
                        </div>

                        {(activePath !== '' && activePath !== '/') && (
                            <div className="file-item" onClick={goUpdir} onDrop={handleDrop}>
                                <div className="file-icon">📁</div>
                                <div className="file-name">..</div>
                            </div>
                        )}
                        {files.map(file => {
                            const isSelected = selectedFiles.has(file.Name);

                            return (
                                <div
                                    key={file.Name}
                                    className={`file-item ${isSelected ? 'selected' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, file)}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                            if (file.IsDir) {
                                                handleNavigate(file);
                                            } else {
                                                toggleFile(file.Name);
                                            }
                                        }
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        className="file-checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleFile(file.Name)}
                                    />
                                    <div className="file-icon">{file.IsDir ? '📁' : '📄'}</div>
                                    <div className="file-name" title={file.Name}>{file.Name}</div>
                                    {!file.IsDir && <div className="file-size">{(file.Size / 1024).toFixed(1)} KB</div>}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
