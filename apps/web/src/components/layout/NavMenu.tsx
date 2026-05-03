import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', label: '采集' },
  { to: '/scales', label: '天平' },
  { to: '/projects', label: '项目' },
  { to: '/cups', label: '杯库' },
  { to: '/records', label: '数据' },
];

export function NavMenu(): React.ReactElement {
  return (
    <nav className="flex gap-0.5">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--bg-2)] hover:text-[var(--text)]',
              isActive && 'bg-[var(--bg-2)] text-[var(--acc)]',
            )
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
