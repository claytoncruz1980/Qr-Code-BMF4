import React, { useEffect, useRef } from 'react';
import { useLab } from '../context/LabContext';

export const AutoUpdateListener: React.FC = () => {
  const { forceSyncMaster } = useLab();
  const initialVersionRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Fetch initial version
    fetch('/version.json?t=' + Date.now())
      .then(res => res.json())
      .then(data => {
        if (data && data.version) {
          initialVersionRef.current = data.version;
        }
      })
      .catch(() => {});

    // 2. Poll version every 45 seconds for new deployments
    const versionInterval = setInterval(async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        const data = await res.json();
        if (data && data.version && initialVersionRef.current) {
          if (data.version !== initialVersionRef.current) {
            console.log('[AutoUpdate] New version detected:', data.version, 'Reloading app...');
            window.location.reload();
          }
        }
      } catch (err) {
        // Network offline or failed
      }
    }, 45000);

    // 3. Instant data sync on tab visibility change or window focus (mobile PWA / switching tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        forceSyncMaster();
      }
    };

    const handleWindowFocus = () => {
      forceSyncMaster();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(versionInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [forceSyncMaster]);

  return null;
};
