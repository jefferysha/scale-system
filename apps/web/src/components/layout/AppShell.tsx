import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function AppShell(): React.ReactElement {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden bg-[var(--bg-0)]">
      <Header />
      <main className="overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
