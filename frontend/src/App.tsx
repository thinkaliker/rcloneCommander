import { useState, useEffect } from 'react';
import './App.css';
import { Pane } from './components/Pane';
import type { RcloneFile, CopyJob } from './types';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [remotes, setRemotes] = useState<string[]>([]);

  // Left Pane State
  const [leftRemote, setLeftRemote] = useState<string>('Local Filesystem');
  const [leftPath, setLeftPath] = useState<string>('');
  const [leftFiles, setLeftFiles] = useState<RcloneFile[]>([]);
  const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
  const [leftLoading, setLeftLoading] = useState(false);

  // Right Pane State
  const [rightRemote, setRightRemote] = useState<string>('Local Filesystem');
  const [rightPath, setRightPath] = useState<string>('');
  const [rightFiles, setRightFiles] = useState<RcloneFile[]>([]);
  const [rightSelected, setRightSelected] = useState<Set<string>>(new Set());
  const [rightLoading, setRightLoading] = useState(false);

  // Job State
  const [activeJobs, setActiveJobs] = useState<Record<string, CopyJob>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copyDirection, setCopyDirection] = useState<'L2R' | 'R2L'>('L2R');
  const [threads, setThreads] = useState(4);

  useEffect(() => {
    fetch(`${API_BASE}/remotes`)
      .then(res => res.json())
      .then(data => {
        if (data.remotes) {
          setRemotes(data.remotes);
          if (data.remotes.length > 1) {
            setRightRemote(data.remotes[1]);
          }
        }
      })
      .catch(console.error);
  }, []);

  const fetchFiles = async (remote: string, path: string, setFiles: (f: RcloneFile[]) => void, setLoading: (l: boolean) => void) => {
    setLoading(true);
    try {
      const fullPath = remote === 'Local Filesystem' ? path || 'Local Filesystem' : `${remote}${path}`;
      const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(fullPath)}`);
      const data = await res.json();
      if (data.files) {
        const sorted = data.files.sort((a: RcloneFile, b: RcloneFile) => {
          if (a.IsDir && !b.IsDir) return -1;
          if (!a.IsDir && b.IsDir) return 1;
          return a.Name.localeCompare(b.Name);
        });
        setFiles(sorted);
      } else {
        setFiles([]);
      }
    } catch (err) {
      console.error(err);
      setFiles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles(leftRemote, leftPath, setLeftFiles, setLeftLoading);
    setLeftSelected(new Set());
  }, [leftRemote, leftPath]);

  useEffect(() => {
    fetchFiles(rightRemote, rightPath, setRightFiles, setRightLoading);
    setRightSelected(new Set());
  }, [rightRemote, rightPath]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_BASE}/copy/status`)
        .then(res => res.json())
        .then(data => {
          if (data.jobs) setActiveJobs(data.jobs);
        })
        .catch(console.error);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleSelection = (fileName: string, selected: Set<string>, setSelected: (s: Set<string>) => void) => {
    const newSelected = new Set(selected);
    if (newSelected.has(fileName)) {
      newSelected.delete(fileName);
    } else {
      newSelected.add(fileName);
    }
    setSelected(newSelected);
  };

  const getFullPath = (remote: string, pathParam: string, file: string) => {
    let base = remote === 'Local Filesystem' ? 'Local Filesystem:' + pathParam : remote + pathParam;
    if (!base.endsWith('/')) base += '/';
    return base + file;
  };

  const handleCopyConfirm = async () => {
    setIsModalOpen(false);

    let sourceRemote = copyDirection === 'L2R' ? leftRemote : rightRemote;
    let sourcePath = copyDirection === 'L2R' ? leftPath : rightPath;
    let selectedSet = copyDirection === 'L2R' ? leftSelected : rightSelected;

    let destRemote = copyDirection === 'L2R' ? rightRemote : leftRemote;
    let destPath = copyDirection === 'L2R' ? rightPath : leftPath;

    for (const fileName of Array.from(selectedSet)) {
      const sourceFile = getFullPath(sourceRemote, sourcePath, fileName);

      const fileList = copyDirection === 'L2R' ? leftFiles : rightFiles;
      const fileObj = fileList.find(f => f.Name === fileName);

      let destStr = getFullPath(destRemote, destPath, '');
      if (fileObj?.IsDir) {
        destStr = getFullPath(destRemote, destPath, fileObj.Name);
      }

      try {
        await fetch(`${API_BASE}/copy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: sourceFile,
            destination: destStr,
            threads: threads
          })
        });
      } catch (e) {
        console.error(e);
      }
    }

    setLeftSelected(new Set());
    setRightSelected(new Set());
  };

  const handleDragAndDrop = async (source: any, dest: any) => {
    const sourceFile = getFullPath(source.sourceRemote, source.sourcePath, source.fileName);
    let destStr = getFullPath(dest.destRemote, dest.destPath, '');
    if (source.isDir) {
      destStr = getFullPath(dest.destRemote, dest.destPath, source.fileName);
    }

    try {
      await fetch(`${API_BASE}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: sourceFile,
          destination: destStr,
          threads: threads
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const hasRunningJobs = Object.values(activeJobs).some(j => j.status === 'running');
  const runningJobs = Object.values(activeJobs).filter(j => j.status === 'running');

  return (
    <div className="app-container">
      <div className="header">
        <h1>rclone<span>Commander</span></h1>
      </div>

      <div className="main-content">
        <Pane
          title="Left Pane"
          remotes={remotes}
          activeRemote={leftRemote}
          activePath={leftPath}
          setActiveRemote={setLeftRemote}
          setActivePath={setLeftPath}
          files={leftFiles}
          selectedFiles={leftSelected}
          toggleFile={(file) => toggleSelection(file, leftSelected, setLeftSelected)}
          isLoading={leftLoading}
          onDropFile={handleDragAndDrop}
        />

        <div className="controls-bar" style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <button
            className="btn-primary"
            disabled={leftSelected.size === 0}
            onClick={() => { setCopyDirection('L2R'); setIsModalOpen(true); }}
          >
            Copy ➡️
          </button>

          <button
            className="btn-primary"
            disabled={rightSelected.size === 0}
            onClick={() => { setCopyDirection('R2L'); setIsModalOpen(true); }}
          >
            ⬅️ Copy
          </button>
        </div>

        <Pane
          title="Right Pane"
          remotes={remotes}
          activeRemote={rightRemote}
          activePath={rightPath}
          setActiveRemote={setRightRemote}
          setActivePath={setRightPath}
          files={rightFiles}
          selectedFiles={rightSelected}
          toggleFile={(file) => toggleSelection(file, rightSelected, setRightSelected)}
          isLoading={rightLoading}
          onDropFile={handleDragAndDrop}
        />
      </div>

      {isModalOpen && (
        <div className="overlay">
          <div className="modal">
            <h2>Confirm Copy</h2>
            <p>Copy {copyDirection === 'L2R' ? leftSelected.size : rightSelected.size} items from {copyDirection === 'L2R' ? 'Left' : 'Right'} to {copyDirection === 'L2R' ? 'Right' : 'Left'}?</p>

            <div className="modal-input">
              <label>Threads (Multi-threading)</label>
              <input type="number" min="1" max="16" value={threads} onChange={(e) => setThreads(parseInt(e.target.value) || 4)} className="path-input" />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn-primary" style={{ background: '#555', boxShadow: 'none' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCopyConfirm}>Start Copy</button>
            </div>
          </div>
        </div>
      )}

      {hasRunningJobs && (
        <div className="overlay" style={{ background: 'transparent', pointerEvents: 'none', alignItems: 'flex-end', paddingBottom: '30px' }}>
          <div className="modal" style={{ pointerEvents: 'all', width: '500px' }}>
            <h3 style={{ color: '#fff', marginBottom: '10px' }}>Active Jobs</h3>
            {runningJobs.map(job => (
              <div key={job.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa', marginBottom: '5px' }}>
                  <span>{job.source.split('/').pop()}</span>
                  <span>{job.progress}</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: job.progress.includes('%') ? job.progress.split('%')[0] + '%' : '100%' }}></div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <p className="status-text">Copying in background...</p>
              <button className="btn-primary" style={{ marginLeft: 20, padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                fetchFiles(leftRemote, leftPath, setLeftFiles, setLeftLoading);
                fetchFiles(rightRemote, rightPath, setRightFiles, setRightLoading);
              }}>Refresh Views</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
