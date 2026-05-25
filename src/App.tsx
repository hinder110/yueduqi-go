import { Routes, Route, Navigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import ChaptersPage from './pages/ChaptersPage';
import ReaderPage from './pages/ReaderPage';
import BookshelfPage from './pages/BookshelfPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/chapters" element={<ChaptersPage />} />
      <Route path="/reader" element={<ReaderPage />} />
      <Route path="/bookshelf" element={<BookshelfPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
