import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.ReactElement {
  return (
    <main className="grid min-h-screen place-items-center text-[var(--text)]">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">404</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">页面不存在</p>
        <Link to="/" className="mt-4 inline-block text-[var(--acc)]">
          回首页
        </Link>
      </div>
    </main>
  );
}
