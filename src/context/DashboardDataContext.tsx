import { createContext, useContext, type ReactNode } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';

const DashboardDataContext = createContext<ReturnType<typeof useDashboardData> | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const value = useDashboardData();
  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardDataProvider');
  return ctx;
}
