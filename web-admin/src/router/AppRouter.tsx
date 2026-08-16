import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { OverviewPage } from '../pages/OverviewPage';
import { DeviceMonitoringPage } from '../pages/DeviceMonitoringPage';
import { TempHumidityMonitoringPage } from '../pages/monitoring/TempHumidityMonitoringPage';
import { HomesPage } from '../pages/HomesPage';
import { RoomsPage } from '../pages/RoomsPage';
import { DevicesPage } from '../pages/DevicesPage';
import { AutomationsPage } from '../pages/AutomationsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LoginPage } from '../pages/LoginPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-md text-primary">
          <span className="material-symbols-outlined text-4xl animate-spin">
            progress_activity
          </span>
          <span className="font-label-caps text-label-caps uppercase tracking-wider">
            Loading Smart Home Admin...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Device router redirect helper
const DeviceMonitoringRedirect: React.FC = () => {
  const { deviceUid } = useParams<{ deviceUid: string }>();
  return <Navigate to={`/monitoring/temp-humidity/${deviceUid}`} replace />;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Monitoring Group */}
          <Route index element={<OverviewPage />} />
          <Route path="monitoring" element={<DeviceMonitoringPage />} />
          <Route path="monitoring/temp-humidity/:deviceUid" element={<TempHumidityMonitoringPage />} />
          <Route path="monitoring/:deviceUid" element={<DeviceMonitoringRedirect />} />

          {/* Manajemen Group */}
          <Route path="homes" element={<HomesPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="automations" element={<AutomationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
