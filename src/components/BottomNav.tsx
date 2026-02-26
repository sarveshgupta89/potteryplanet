import { NavLink } from 'react-router-dom';
import { Home, Camera, Heart, Settings } from 'lucide-react';
import { clsx } from 'clsx';

export default function BottomNav() {
  const navItems = [
    { to: '/', icon: Home, label: 'Catalog' },
    { to: '/search', icon: Camera, label: 'Search' },
    { to: '/wishlist', icon: Heart, label: 'Wishlist' },
    { to: '/admin', icon: Settings, label: 'Admin' },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-stone-200 px-6 py-3 pb-safe flex justify-between items-center z-50">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center gap-1 transition-colors',
              isActive ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
            )
          }
        >
          <Icon size={24} strokeWidth={2} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
