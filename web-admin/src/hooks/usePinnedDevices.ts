import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'smart_home_pinned_devices';

export function usePinnedDevices() {
  const [pinnedUids, setPinnedUids] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedUids));
    } catch (e) {
      console.error('Failed to save pinned devices to localStorage', e);
    }
  }, [pinnedUids]);

  const togglePin = useCallback((deviceUid: string) => {
    setPinnedUids((prev) =>
      prev.includes(deviceUid) ? prev.filter((id) => id !== deviceUid) : [...prev, deviceUid],
    );
  }, []);

  const isPinned = useCallback(
    (deviceUid: string) => pinnedUids.includes(deviceUid),
    [pinnedUids],
  );

  return { pinnedUids, togglePin, isPinned };
}
