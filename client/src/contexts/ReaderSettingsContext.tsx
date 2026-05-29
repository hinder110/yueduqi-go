import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
type FontSize = 'sm' | 'md' | 'lg';
type PageMode = 'scroll' | 'pagination';

interface ReaderSettings {
  fontSize: FontSize;
  theme: Theme;
  pageMode: PageMode;
}

interface ReaderSettingsState extends ReaderSettings {
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  cycleFontSize: () => void;
}

const FONT_NEXT: Record<FontSize, FontSize> = { sm: 'md', md: 'lg', lg: 'sm' };

const defaults: ReaderSettings = {
  fontSize: 'md',
  theme: 'light',
  pageMode: 'scroll',
};

function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem('readerSettings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch { /* ignore */ }
  return defaults;
}

function saveSettings(s: ReaderSettings) {
  localStorage.setItem('readerSettings', JSON.stringify(s));
}

const ReaderSettingsContext = createContext<ReaderSettingsState | null>(null);

export function ReaderSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const setFontSize = useCallback((fontSize: FontSize) => {
    setSettings(prev => ({ ...prev, fontSize }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setSettings(prev => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  }, []);

  const cycleFontSize = useCallback(() => {
    setSettings(prev => ({ ...prev, fontSize: FONT_NEXT[prev.fontSize] }));
  }, []);

  return (
    <ReaderSettingsContext.Provider value={{ ...settings, setFontSize, setTheme, toggleTheme, cycleFontSize }}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  const ctx = useContext(ReaderSettingsContext);
  if (!ctx) throw new Error('useReaderSettings must be inside ReaderSettingsProvider');
  return ctx;
}
