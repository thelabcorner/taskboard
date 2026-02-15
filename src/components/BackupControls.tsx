import { Download, Upload } from 'lucide-react';
import { useRef } from 'react';
import { BoardState } from '../types';
import { exportBoard, importBoard, getLastBackupText } from '../utils/BackupManager';

interface BackupControlsProps {
  state: BoardState;
  onImport: (state: BoardState) => void;
  onExportClick?: () => void;
}

export function BackupControls({ state, onImport, onExportClick }: BackupControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const success = exportBoard(state, `taskboard-${timestamp}`);
    if (success && onExportClick) {
      onExportClick();
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const imported = await importBoard(file);
    if (imported) {
      if (confirm('Replace your current taskboard with the imported data? This cannot be undone.')) {
        onImport(imported);
        alert('Taskboard imported successfully!');
      }
    } else {
      alert('Failed to import taskboard. Please check the file format.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/30 border border-zinc-800 text-xs text-zinc-400">
        <span className="hidden sm:inline">Backup: {getLastBackupText()}</span>
        <span className="sm:hidden">Last: {getLastBackupText()}</span>
      </div>

      <button
        onClick={handleExport}
        className="p-2 rounded-lg bg-zinc-900/30 hover:bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-300 transition-colors"
        title="Export taskboard as compressed backup"
      >
        <Download className="w-4 h-4" />
      </button>

      <button
        onClick={handleImportClick}
        className="p-2 rounded-lg bg-zinc-900/30 hover:bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-300 transition-colors"
        title="Import taskboard from backup file"
      >
        <Upload className="w-4 h-4" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json.gz"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Import taskboard"
      />
    </div>
  );
}

