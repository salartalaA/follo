import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-overlay fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl border border-primary/40 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg md:bottom-4"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span>Offline Mode — Changes stay saved on your device</span>
    </div>
  );
}
