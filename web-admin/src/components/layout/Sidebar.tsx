import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

const navigationItems = [
  { name: 'Overview', path: '/', icon: 'dashboard' },
  { name: 'Homes', path: '/homes', icon: 'home' },
  { name: 'Rooms', path: '/rooms', icon: 'grid_view' },
  { name: 'Devices', path: '/devices', icon: 'devices' },
  { name: 'Sensors', path: '/sensors', icon: 'sensors' },
  { name: 'Automations', path: '/automations', icon: 'auto_mode' },
  { name: 'Settings', path: '/settings', icon: 'settings' },
];

export const Sidebar: React.FC = () => {
  const { logout } = useAuth();

  return (
    <aside className="w-sidebar-width h-screen border-r border-outline-variant bg-surface flex flex-col fixed left-0 top-0 z-20">
      {/* Brand Header */}
      <div className="p-lg border-b border-outline-variant flex items-center gap-md">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
        >
          smart_toy
        </span>
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">
            Admin Panel
          </h1>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Smart Home v2.4
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-md overflow-y-auto">
        <ul className="flex flex-col">
          {navigationItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-md py-3 px-lg cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-secondary-container/10 border-l-[3px] border-primary text-primary font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container-low active:scale-98'
                  }`
                }
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Profile & Logout */}
      <div className="border-t border-outline-variant p-md">
        <ul className="flex flex-col">
          <li>
            <NavLink
              to="/settings"
              className="flex items-center gap-md text-on-surface-variant py-3 px-lg hover:bg-surface-container-low transition-colors cursor-pointer active:scale-98 transition-all duration-150"
            >
              <span className="material-symbols-outlined">account_circle</span>
              Profile
            </NavLink>
          </li>
          <li>
            <button
              onClick={logout}
              className="w-full flex items-center gap-md text-on-surface-variant hover:text-error py-3 px-lg hover:bg-error-container/20 transition-colors cursor-pointer active:scale-98 transition-all duration-150 text-left"
            >
              <span className="material-symbols-outlined">logout</span>
              Logout
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
};
