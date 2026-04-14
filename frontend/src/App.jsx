import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PlayerPage from './pages/PlayerPage.jsx';
import Favorites from './pages/Favorites.jsx';
import Compare from './pages/Compare.jsx';
import Predictions from './pages/Predictions.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/player/:id" element={<PlayerPage />} />
          <Route path="/app/favorites" element={<Favorites />} />
          <Route path="/app/compare" element={<Compare />} />
          <Route path="/app/predictions" element={<Predictions />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-5xl font-extrabold gradient-text">404</h1>
      <p className="mt-3 text-slate-300">This page isn't in the playbook.</p>
      <a href="/" className="btn-primary mt-6 inline-flex">Go home</a>
    </div>
  );
}
