import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const app = express();
const port = 3001;
const execAsync = promisify(exec);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running and listening for rclone commands.');
});

// Data structures for tracking jobs
interface CopyJob {
  id: string;
  source: string;
  destination: string;
  progress: string; // latest percentage or text from stdout
  status: 'running' | 'completed' | 'error';
  threads: number;
}
const activeJobs: Record<string, CopyJob> = {};

app.get('/api/remotes', async (req, res) => {
  try {
    const { stdout } = await execAsync('rclone listremotes');
    const remotes = stdout.split('\n').map(r => r.trim()).filter(r => r.length > 0);
    // Include a local filesystem specifier
    res.json({ remotes: ['Local Filesystem', ...remotes] });
  } catch (error: any) {
    console.error('Error fetching remotes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files', async (req, res) => {
  const targetPath = req.query.path as string;
  if (!targetPath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  try {
    // Determine actual path for rclone
    // If it's "Local Filesystem", the root path will just be / (or drive letter on Windows)
    let rclonePath = targetPath;
    if (rclonePath === 'Local Filesystem' || rclonePath === 'Local Filesystem:') {
      // Special case to list root for local system. On Mac/Linux, this is '/'
      rclonePath = '/';
    } else if (rclonePath.startsWith('Local Filesystem:')) {
      rclonePath = rclonePath.replace('Local Filesystem:', '');
    }

    // Fallback default
    if (rclonePath === '') {
      rclonePath = '/';
    }

    const { stdout } = await execAsync(`rclone lsjson "${rclonePath}"`);
    const files = JSON.parse(stdout);
    res.json({ files });
  } catch (error: any) {
    console.error(`Error fetching files for path ${targetPath}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/copy', (req, res) => {
  const { source, destination, threads } = req.body;

  if (!source || !destination) {
    return res.status(400).json({ error: 'source and destination are required' });
  }

  const numThreads = threads || 4;
  const jobId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(7);

  const formatPath = (p: string) => {
    if (p.startsWith('Local Filesystem:')) return p.replace('Local Filesystem:', '');
    if (p === 'Local Filesystem') return '/';
    return p;
  };

  const srcPath = formatPath(source);
  const destPath = formatPath(destination);

  activeJobs[jobId] = {
    id: jobId,
    source: srcPath,
    destination: destPath,
    progress: 'Starting...',
    status: 'running',
    threads: numThreads,
  };

  const child = spawn('rclone', [
    'copy',
    srcPath,
    destPath,
    '--progress',
    '--stats=1s',
    `--transfers=${numThreads}`
  ]);

  child.stderr.on('data', (data) => {
    // rclone normally prints progress to stderr
    const output = data.toString();

    // Parse progress percentage (e.g. "Transferred: ... 45%")
    const match = output.match(/Transferred:\s+.*?([0-9.]+)%/);
    if (match) {
      activeJobs[jobId].progress = `${match[1]}%`;
    } else {
      // Just store the latest text line if we can't find a percentage
      const lines = output.split('\n');
      for (const line of lines.reverse()) {
        if (line.trim().length > 0 && line.includes('Transferred:')) {
          activeJobs[jobId].progress = line.trim();
          break;
        }
      }
    }
  });

  child.on('close', (code) => {
    activeJobs[jobId].status = code === 0 ? 'completed' : 'error';
    if (code === 0) activeJobs[jobId].progress = '100%';
  });

  res.json({ jobId, message: 'Copy job started' });
});

app.get('/api/copy/status', (req, res) => {
  res.json({ jobs: activeJobs });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
