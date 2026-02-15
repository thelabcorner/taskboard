import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';

interface RecoveryNotificationProps {
  source: 'indexeddb' | 'localstorage' | 'cookies';
  onDismiss: () => void;
}

const SOURCE_LABELS = {
  indexeddb: 'IndexedDB backup',
  localstorage: 'Browser storage backup',
  cookies: 'Cookie backup',
};

const SOURCE_DETAILS = {
  indexeddb: 'Your data was recovered from the IndexedDB recovery backup.',
  localstorage: 'Your data was recovered from the browser storage backup.',
  cookies: 'Your data was recovered from the cookie backup.',
};

export function RecoveryNotification({ source, onDismiss }: RecoveryNotificationProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-900/60 rounded-lg backdrop-blur-md p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-green-100 mb-1">
              Data Recovered
            </h3>
            <p className="text-xs text-green-200 mb-2">
              {SOURCE_DETAILS[source]}
            </p>
            <p className="text-xs text-green-300/70">
              Recovery source: <span className="font-medium">{SOURCE_LABELS[source]}</span>
            </p>
          </div>
          <button
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
            className="flex-shrink-0 text-green-600 hover:text-green-500 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

