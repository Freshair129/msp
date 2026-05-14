import { useState } from 'react';

export function useTweaks<T>(defaults: T): [T, (key: string | Partial<T>, value?: any) => void] {
  const [tweaks, setTweaks] = useState<T>(defaults);

  const setTweak = (key: string | Partial<T>, value?: any) => {
    if (typeof key === 'string') {
      setTweaks(prev => ({ ...prev, [key]: value }));
    } else {
      setTweaks(prev => ({ ...prev, ...key }));
    }
  };

  return [tweaks, setTweak];
}
