import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { shouldShowBackupReminder, getLastBackupText } from '../utils/BackupManager';

interface BackupReminderProps {
  onExport: () => void;
}

export function BackupReminder({ onExport }: BackupReminderProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !shouldShowBackupReminder()) {
    return null;
  }

  return (
    <div className="relative z-30 bg-amber-950/40 border-b border-amber-900/30 backdrop-blur-sm">
      <div className="px-6 py-3 flex items-start gap-3 sm:items-center sm:gap-4">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-100">
            <span className="font-semibold">Backup your taskboard!</span> Last backup: {getLastBackupText()}
          </p>
          <p className="text-xs text-amber-200 mt-1">
            Your data is stored locally in your browser. Clearing cookies, cache, or browsing data may delete it permanently. Export a backup regularly to keep your tasks safe.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onExport}
            className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors"
          >
            Export now
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-amber-600 hover:text-amber-500 hover:bg-amber-900/20 rounded-md transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

