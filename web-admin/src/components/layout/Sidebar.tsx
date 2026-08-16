import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

interface NavSection {
  title: string;
  items: {
    name: string;
    path: string;
    icon: string;
    exact?: boolean;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'MONITORING',
    items: [
      { name: 'Overview', path: '/', icon: 'dashboard', exact: true },
      { name: 'Device Monitoring', path: '/monitoring', icon: 'monitor_heart' },
    ],
  },
  {
    title: 'MANAJEMEN',
    items: [
      { name: 'Homes', path: '/homes', icon: 'home' },
      { name: 'Rooms', path: '/rooms', icon: 'grid_view' },
      { name: 'Devices', path: '/devices', icon: 'devices' },
      { name: 'Automations', path: '/automations', icon: 'auto_mode' },
      { name: 'Settings', path: '/settings', icon: 'settings' },
    ],
  },
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
            Smart Home Platform
          </p>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 py-md overflow-y-auto space-y-md">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-lg py-1">
              <span className="font-label-caps text-[11px] font-bold text-outline tracking-wider uppercase">
                {section.title}
              </span>
            </div>
            <ul className="flex flex-col">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-md py-2.5 px-lg cursor-pointer transition-all duration-150 text-sm ${
                        isActive
                          ? 'bg-secondary-container/15 border-l-[3px] border-primary text-primary font-bold'
                          : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface active:scale-98'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom Profile & Logout */}
      <div className="border-t border-outline-variant p-md">
        <ul className="flex flex-col">
          <li>
            <NavLink
              to="/settings"
              className="flex items-center gap-md text-on-surface-variant py-2.5 px-lg hover:bg-surface-container-low transition-colors cursor-pointer active:scale-98 text-sm"
            >
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
              Profile
            </NavLink>
          </li>
          <li>
            <button
              onClick={logout}
              className="w-full flex items-center gap-md text-on-surface-variant hover:text-error py-2.5 px-lg hover:bg-error-container/20 transition-colors cursor-pointer active:scale-98 text-left text-sm"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Logout
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
};
