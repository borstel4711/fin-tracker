import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import ImportPage from './pages/ImportPage';
import Categories from './pages/Categories';
import Rules from './pages/Rules';
import Balance from './pages/Balance';

const navItems = [
  { to: '/', label: 'Übersicht' },
  { to: '/transactions', label: 'Buchungen' },
  { to: '/import', label: 'Import' },
  { to: '/balance', label: 'Saldo' },
  { to: '/categories', label: 'Kategorien' },
  { to: '/rules', label: 'Regeln' },
];

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="bg-slate-900 text-white px-4 py-3">
          <h1 className="text-lg font-semibold mb-2">FinTrack</h1>
          <nav className="flex gap-4 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => (isActive ? 'text-white font-semibold' : 'text-slate-300 hover:text-white')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="p-4 max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/balance" element={<Balance />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/rules" element={<Rules />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
