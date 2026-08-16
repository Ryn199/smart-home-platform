import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { useWebSocket } from '../../websocket/socket';

const pageTitleMap: Record<string, string> = {
  '/': 'Smart Home Overview',
  '/homes': 'Homes Management',
  '/rooms': 'Rooms Management',
  '/devices': 'Devices Management',
  '/sensors': 'Sensors & Telemetry',
  '/automations': 'Automation Rules',
  '/settings': 'System Settings',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isConnected } = useWebSocket();

  const title = pageTitleMap[location.pathname] || 'Smart Home';
  const pageName = title.replace('Smart Home ', '').replace(' Management', '');

  return (
    <header className="h-20 w-full border-b border-outline-variant bg-surface-bright flex justify-between items-center px-lg py-md z-10">
      {/* Title */}
      <div className="flex items-center gap-md">
        <span className="font-headline-md text-headline-md font-semibold text-on-surface">
          {title}
        </span>
      </div>

      {/* Breadcrumb & Right Actions */}
      <div className="flex items-center gap-lg">
        {/* Connection status badge */}
        <div
          className={`flex items-center gap-xs text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${
            isConnected
              ? 'text-[#059669] bg-[#ecfdf5]'
              : 'text-error bg-error-container/40'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-[#10b981] animate-pulse' : 'bg-error'
            }`}
          />
          {isConnected ? 'Real-Time Online' : 'Connecting WS'}
        </div>

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-sm font-label-caps text-label-caps">
          <Link
            to="/"
            className="text-on-surface-variant hover:text-primary transition-all duration-200"
          >
            Smart Home
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="text-primary font-semibold transition-all duration-200">
            {pageName}
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-md text-on-surface-variant">
          <Link
            to="/settings"
            title={user?.email || 'User'}
            className="flex items-center gap-sm hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">account_circle</span>
            <span className="hidden sm:inline font-body-md text-sm font-medium">
              {user?.name || 'Admin'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
};
