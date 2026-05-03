import { Link } from 'react-router-dom';

export default function HomePage(): React.ReactElement {
  return (
    <div className="p-8">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">导航</h2>
      <nav className="grid gap-2 text-[var(--acc)]">
        <Link to="/">采集页（Phase 4 实现）</Link>
        <Link to="/scales">天平管理（Phase 5）</Link>
        <Link to="/projects">项目管理（Phase 5）</Link>
        <Link to="/cups">杯库管理（Phase 5）</Link>
        <Link to="/records">数据浏览（Phase 5）</Link>
      </nav>
    </div>
  );
}
