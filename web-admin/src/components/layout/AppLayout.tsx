import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-container-lowest">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Wrapper */}
      <div className="ml-sidebar-width flex-1 flex flex-col h-full overflow-hidden bg-surface-container-lowest">
        <Header />
        <main className="flex-1 overflow-y-auto p-lg lg:p-xl space-y-lg max-w-[1440px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
