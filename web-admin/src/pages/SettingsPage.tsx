import React from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useWebSocket } from '../websocket/socket';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();

  return (
    <div className="space-y-lg max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
          System Settings
        </h2>
        <p className="text-sm text-on-surface-variant">
          Platform configurations, user profile, and connectivity status.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="bg-surface border border-outline-variant rounded-xl p-lg space-y-md shadow-sm shadow-black/5">
        <h3 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">person</span>
          User Profile
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md text-sm">
          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
              Full Name
            </span>
            <p className="font-semibold text-on-surface">{user?.name || '-'}</p>
          </div>
          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
              Email Address
            </span>
            <p className="font-semibold text-on-surface">{user?.email || '-'}</p>
          </div>
        </div>
        <div className="pt-sm border-t border-outline-variant">
          <button
            onClick={logout}
            className="px-4 py-2 border border-error text-error hover:bg-error-container/20 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            Log Out of Session
          </button>
        </div>
      </div>

      {/* System & Architecture Info */}
      <div className="bg-surface border border-outline-variant rounded-xl p-lg space-y-md shadow-sm shadow-black/5">
        <h3 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">dns</span>
          Backend & Gateway Status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md text-sm">
          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
              REST API Endpoint
            </span>
            <p className="font-data-mono text-outline text-xs">
              {window.location.origin}/api
            </p>
          </div>

          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
              WebSocket Connection
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-[#10b981] animate-pulse' : 'bg-error'
                }`}
              />
              <span className="font-semibold text-xs font-data-mono uppercase">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
              Offline Threshold
            </span>
            <p className="font-semibold text-on-surface">60 Seconds</p>
          </div>

          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
              Web Admin Version
            </span>
            <p className="font-semibold text-on-surface">v2.4.0 (Vite + React)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
