'use client';

import React from 'react';
import Navbar from '@/components/Navbar';

interface AppShellProps {
  children: React.ReactNode;
  onNewProject: () => void;
}

export function AppShell({ children, onNewProject }: AppShellProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar onNewProject={onNewProject} />
      <main className="flex-1">{children}</main>
    </div>
  );
} 