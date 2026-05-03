# Phase 3 · 前端基建（路由 + 主题 + AppShell + API client）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。前置：Phase 0 已完成。Worktree：`../scale-system-fe-infra` 分支 `phase-3/frontend-infrastructure`。

**Goal:** 把 `apps/web` 从空壳填成可登录可导航的前端外壳：React Router + TanStack Query + 主题系统 + AppShell + Login 页 + 受保护路由。**不**实现任何业务页（业务页是 Phase 4/5）。

**Architecture:** 路由层只做路由；业务逻辑沉到 features；TanStack Query 管服务端态；Zustand 管客户端态（主题、auth）；shadcn 提供 UI primitive。

**Tech Stack:** React 19 / Vite 6 / Tailwind v4 / shadcn/ui / React Router v7 / TanStack Query v5 / Zustand v5 / React Hook Form + Zod / Axios

---

## Task 3.1 · Tailwind 主题 token 完整迁移

**Files:**
- Create: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles/globals.css`
- Modify: `apps/web/index.html`

- [ ] **Step 1:** 写 `src/styles/tokens.css`（从现 HTML 完整迁移）

```css
:root {
  --r-1: 6px;
  --r-2: 10px;
  --r-3: 14px;
  --t-fast: 120ms;
  --t-mid: 240ms;
  --t-slow: 520ms;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

[data-theme='dark'] {
  --bg-0: #06090f;
  --bg-1: #0c121d;
  --bg-2: #121a28;
  --bg-3: #172033;
  --line: rgba(120, 150, 180, 0.16);
  --line-2: rgba(150, 190, 220, 0.32);
  --text: #e6ecf3;
  --text-2: #9aa7bb;
  --text-3: #5e6b80;
  --acc: #00e6a3;
  --acc-2: #3ad8ff;
  --acc-shade: rgba(0, 230, 163, 0.18);
  --warn: #ffb547;
  --danger: #ff5d6c;
  --info: #4cc9f0;
  --grid: rgba(0, 230, 163, 0.05);
  --panel-stripe: linear-gradient(180deg, rgba(0, 230, 163, 0.1), rgba(0, 230, 163, 0));
  --shadow-1: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 14px 36px -22px rgba(0, 0, 0, 0.7);
  --led-glow: 0 0 6px #00e6a3, 0 0 14px rgba(0, 230, 163, 0.55);
}

[data-theme='light'] {
  --bg-0: #eef2f7;
  --bg-1: #ffffff;
  --bg-2: #f7f9fc;
  --bg-3: #eaeef5;
  --line: #dde3ee;
  --line-2: #bbc4d4;
  --text: #0f1626;
  --text-2: #4a5468;
  --text-3: #8590a4;
  --acc: #1e4ea8;
  --acc-2: #ff6b1a;
  --acc-shade: rgba(30, 78, 168, 0.1);
  --warn: #d97706;
  --danger: #d6315c;
  --info: #0a78a8;
  --grid: rgba(30, 78, 168, 0.05);
  --panel-stripe: linear-gradient(180deg, rgba(30, 78, 168, 0.07), rgba(30, 78, 168, 0));
  --shadow-1: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 12px 32px -20px rgba(20, 40, 80, 0.22);
  --led-glow: 0 0 6px #16a37a, 0 0 14px rgba(22, 163, 122, 0.4);
}
```

- [ ] **Step 2:** 改 `src/styles/globals.css` 接入 Tailwind v4 + tokens

```css
@import './tokens.css';
@import 'tailwindcss';

@theme inline {
  --color-bg-0: var(--bg-0);
  --color-bg-1: var(--bg-1);
  --color-bg-2: var(--bg-2);
  --color-bg-3: var(--bg-3);
  --color-line: var(--line);
  --color-line-2: var(--line-2);
  --color-text: var(--text);
  --color-text-2: var(--text-2);
  --color-text-3: var(--text-3);
  --color-acc: var(--acc);
  --color-acc-2: var(--acc-2);
  --color-warn: var(--warn);
  --color-danger: var(--danger);
  --color-info: var(--info);
  --font-sans: 'Geist', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  background: var(--bg-0);
  color: var(--text);
  font-family: var(--font-sans);
  transition:
    background var(--t-mid) var(--ease),
    color var(--t-mid) var(--ease);
}

.lcd,
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
```

- [ ] **Step 3:** 改 `index.html` 加载 Geist + JetBrains Mono

```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <title>天平称重系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4:** 提交

```bash
git add apps/web/src/styles apps/web/index.html
git commit -m "feat(web): Tailwind v4 主题 token 完整迁移（深/浅双主题）"
```

---

## Task 3.2 · 主题 store + Toggle 组件

**Files:**
- Create: `apps/web/src/stores/theme-store.ts`
- Create: `apps/web/src/components/domain/ThemeToggle.tsx`
- Create: `apps/web/src/hooks/useTheme.ts`
- Test: `apps/web/src/stores/theme-store.test.ts`
- Test: `apps/web/src/components/domain/ThemeToggle.test.tsx`

- [ ] **Step 1:** 写测试 `stores/theme-store.test.ts`

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { useThemeStore } from './theme-store';

describe('theme-store', () => {
  afterEach(() => {
    useThemeStore.getState().setTheme('dark');
    localStorage.clear();
  });

  it('defaults to dark', () => {
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('toggle switches theme', () => {
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('light');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme writes data-theme attr', () => {
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 2:** 跑 fail。

- [ ] **Step 3:** 实现 `stores/theme-store.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const applyTheme = (t: Theme): void => {
  document.documentElement.setAttribute('data-theme', t);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (t) => {
        applyTheme(t);
        set({ theme: t });
      },
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: 'scale-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
```

- [ ] **Step 4:** 实现 `hooks/useTheme.ts`

```ts
import { useThemeStore } from '@/stores/theme-store';

export const useTheme = (): {
  theme: 'dark' | 'light';
  toggle: () => void;
  setTheme: (t: 'dark' | 'light') => void;
} => {
  const { theme, toggle, setTheme } = useThemeStore();
  return { theme, toggle, setTheme };
};
```

- [ ] **Step 5:** 写 `components/domain/ThemeToggle.tsx`

```tsx
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export function ThemeToggle(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex rounded-full border border-[var(--line-2)] bg-[var(--bg-1)] p-0.5">
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 text-xs text-[var(--text-2)] transition-colors',
          theme === 'dark' && 'bg-[var(--acc-shade)] text-[var(--acc)]',
        )}
      >
        <Moon className="size-3" /> 深色
      </button>
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 text-xs text-[var(--text-2)] transition-colors',
          theme === 'light' && 'bg-[var(--acc-shade)] text-[var(--acc)]',
        )}
      >
        <Sun className="size-3" /> 浅色
      </button>
    </div>
  );
}
```

- [ ] **Step 6:** 写 `lib/utils.ts`

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
```

- [ ] **Step 7:** 写测试 `components/domain/ThemeToggle.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';
import { useThemeStore } from '@/stores/theme-store';

describe('<ThemeToggle/>', () => {
  it('clicks switch theme', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('浅色'));
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByText('深色'));
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
```

- [ ] **Step 8:** 跑测试 pass。

- [ ] **Step 9:** 提交

```bash
git add apps/web/src/stores apps/web/src/hooks apps/web/src/components apps/web/src/lib/utils.ts
git commit -m "feat(web): theme-store + ThemeToggle + useTheme hook"
```

---

## Task 3.3 · shadcn 引入 + 基础 UI primitives

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/sonner.tsx`
- Create: `apps/web/src/components/ui/form.tsx`

- [ ] **Step 1:** 加 shadcn 依赖

```bash
cd apps/web
pnpm add @radix-ui/react-slot class-variance-authority @radix-ui/react-dialog @radix-ui/react-label sonner
```

- [ ] **Step 2:** 写 `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 3:** 添加 shadcn 组件

```bash
pnpm dlx shadcn@latest add button input label dialog form sonner
```

如果非交互模式不可用，从 https://ui.shadcn.com/docs/components 复制对应文件到 `src/components/ui/`。

- [ ] **Step 4:** 验证 build + lint

```bash
pnpm typecheck
pnpm build
pnpm lint
```

- [ ] **Step 5:** 提交

```bash
git add apps/web/components.json apps/web/src/components/ui apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): shadcn 引入 + button/input/label/dialog/form/sonner"
```

---

## Task 3.4 · API client（Axios + 拦截器 + 错误结构）

**Files:**
- Create: `apps/web/src/lib/api/error.ts`
- Create: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/lib/api/query-client.ts`
- Test: `apps/web/src/lib/api/client.test.ts`

- [ ] **Step 1:** 写 `lib/api/error.ts`

```ts
export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
    this.status = status;
    this.details = body.details;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
```

- [ ] **Step 2:** 写 `lib/api/client.ts`

```ts
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, type ApiErrorBody } from './error';

const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
type RefreshFn = () => Promise<string | null>;
let refreshFn: RefreshFn | null = null;

export const setAccessToken = (t: string | null): void => {
  accessToken = t;
};
export const getAccessToken = (): string | null => accessToken;
export const setRefreshFn = (fn: RefreshFn | null): void => {
  refreshFn = fn;
};

const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (accessToken) cfg.headers.set('Authorization', `Bearer ${accessToken}`);
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original?._retried && refreshFn) {
      original._retried = true;
      refreshing ??= refreshFn();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        accessToken = newToken;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
    }
    if (err.response?.data?.error) {
      throw new ApiError(err.response.status, err.response.data.error as ApiErrorBody);
    }
    throw err;
  },
);

export { api };
```

- [ ] **Step 3:** 写 `lib/api/query-client.ts`

```ts
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './error';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, err) => {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
```

- [ ] **Step 4:** 写测试 `lib/api/client.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { api, setAccessToken } from './client';
import { ApiError } from './error';

const server = setupServer();

describe('api client', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('attaches bearer token when set', async () => {
    let captured = '';
    server.use(
      http.get('http://test/api/v1/me', ({ request }) => {
        captured = request.headers.get('Authorization') ?? '';
        return HttpResponse.json({ ok: true });
      }),
    );
    setAccessToken('abc');
    api.defaults.baseURL = 'http://test/api/v1';
    await api.get('/me');
    expect(captured).toBe('Bearer abc');
    setAccessToken(null);
  });

  it('throws ApiError on 4xx', async () => {
    server.use(
      http.get('http://test/api/v1/x', () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: '不存在', details: {} } }, { status: 404 }),
      ),
    );
    api.defaults.baseURL = 'http://test/api/v1';
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 5:** 跑测试 pass。

- [ ] **Step 6:** 提交

```bash
git add apps/web/src/lib/api
git commit -m "feat(web): Axios client + 401 自动 refresh + ApiError 统一结构"
```

---

## Task 3.5 · Auth feature（store + login api + hooks）

**Files:**
- Create: `apps/web/src/features/auth/types.ts`
- Create: `apps/web/src/features/auth/api.ts`
- Create: `apps/web/src/features/auth/store.ts`
- Create: `apps/web/src/features/auth/hooks.ts`
- Create: `apps/web/src/features/auth/RequireAuth.tsx`

- [ ] **Step 1:** 写 `features/auth/types.ts`

```ts
export interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'operator' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: User;
  refresh_token: string | null;
}
```

- [ ] **Step 2:** 写 `features/auth/api.ts`

```ts
import { api } from '@/lib/api/client';
import type { TokenResponse, User } from './types';

export const login = async (username: string, password: string): Promise<TokenResponse> => {
  const r = await api.post<TokenResponse>('/auth/login', {
    username,
    password,
    client_kind: 'web',
  });
  return r.data;
};

export const refresh = async (): Promise<TokenResponse> => {
  const r = await api.post<TokenResponse>('/auth/refresh', { csrf_token: 'placeholder' });
  return r.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const me = async (): Promise<User> => {
  const r = await api.get<User>('/auth/me');
  return r.data;
};
```

- [ ] **Step 3:** 写 `features/auth/store.ts`

```ts
import { create } from 'zustand';
import { setAccessToken, setRefreshFn } from '@/lib/api/client';
import type { User } from './types';
import { refresh as apiRefresh } from './api';

interface AuthState {
  user: User | null;
  isAuthenticating: boolean;
  setUser: (u: User | null) => void;
  applyToken: (token: string, user: User) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticating: false,
  setUser: (u) => set({ user: u }),
  applyToken: (token, user) => {
    setAccessToken(token);
    set({ user });
  },
  reset: () => {
    setAccessToken(null);
    set({ user: null });
  },
}));

// 注入 refresh 函数到 axios 拦截器
setRefreshFn(async () => {
  try {
    const r = await apiRefresh();
    useAuthStore.getState().applyToken(r.access_token, r.user);
    return r.access_token;
  } catch {
    useAuthStore.getState().reset();
    return null;
  }
});
```

- [ ] **Step 4:** 写 `features/auth/hooks.ts`

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { login as apiLogin, logout as apiLogout, me } from './api';
import { useAuthStore } from './store';

export const useLogin = () => {
  const apply = useAuthStore((s) => s.applyToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      apiLogin(username, password),
    onSuccess: (data) => {
      apply(data.access_token, data.user);
      void qc.invalidateQueries();
    },
  });
};

export const useLogout = () => {
  const reset = useAuthStore((s) => s.reset);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      reset();
      qc.clear();
    },
  });
};

export const useCurrentUser = () =>
  useQuery({
    queryKey: ['auth', 'me'],
    queryFn: me,
    enabled: useAuthStore.getState().user !== null,
    staleTime: 5 * 60_000,
  });
```

- [ ] **Step 5:** 写 `features/auth/RequireAuth.tsx`

```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store';

export function RequireAuth(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
```

- [ ] **Step 6:** 提交

```bash
git add apps/web/src/features/auth
git commit -m "feat(web): auth feature（store/api/hooks/RequireAuth）"
```

---

## Task 3.6 · 路由层（React Router v7 + 受保护路由）

**Files:**
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/app/routes/login.tsx`
- Create: `apps/web/src/app/routes/index.tsx`
- Create: `apps/web/src/app/routes/not-found.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1:** 写 `app/routes/login.tsx`

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/features/auth/hooks';
import { isApiError } from '@/lib/api/error';

const schema = z.object({
  username: z.string().min(3, '用户名至少 3 字符'),
  password: z.string().min(8, '密码至少 8 字符'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage(): React.ReactElement {
  const { register, handleSubmit, formState: { errors }, setError } = useForm<Form>({
    resolver: zodResolver(schema),
  });
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation() as Location & { state: { from?: Location } };
  const from = location.state?.from?.pathname ?? '/';

  const onSubmit = async (data: Form): Promise<void> => {
    try {
      await login.mutateAsync(data);
      navigate(from, { replace: true });
    } catch (e) {
      const msg = isApiError(e) ? e.message : '登录失败';
      setError('root', { message: msg });
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg-0)]">
      <form onSubmit={handleSubmit(onSubmit)} className="w-80 space-y-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
        <h1 className="text-xl font-semibold text-[var(--text)]">天平称重系统</h1>
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input id="username" autoComplete="username" {...register('username')} />
          {errors.username && <p className="text-xs text-[var(--danger)]">{errors.username.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <p className="text-xs text-[var(--danger)]">{errors.password.message}</p>}
        </div>
        {errors.root && <p className="text-xs text-[var(--danger)]">{errors.root.message}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? '登录中…' : '登录'}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2:** 写 `app/routes/index.tsx`（占位，后续 Phase 4 替换为采集页）

```tsx
import { Link } from 'react-router-dom';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/domain/ThemeToggle';

export default function HomePage(): React.ReactElement {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  return (
    <main className="min-h-screen p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">天平称重系统</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-[var(--text-2)]">{user?.username}</span>
          <Button variant="outline" onClick={() => logout.mutate()}>
            退出
          </Button>
        </div>
      </header>
      <nav className="grid gap-2 text-[var(--acc)]">
        <Link to="/weighing">采集页（Phase 4 实现）</Link>
        <Link to="/scales">天平管理（Phase 5）</Link>
        <Link to="/projects">项目管理（Phase 5）</Link>
        <Link to="/cups">杯库管理（Phase 5）</Link>
        <Link to="/records">数据浏览（Phase 5）</Link>
      </nav>
    </main>
  );
}
```

- [ ] **Step 3:** 写 `app/routes/not-found.tsx`

```tsx
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
```

- [ ] **Step 4:** 写 `app/router.tsx`

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/RequireAuth';
import LoginPage from './routes/login';
import HomePage from './routes/index';
import NotFoundPage from './routes/not-found';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [{ index: true, element: <HomePage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
]);
```

- [ ] **Step 5:** 改 `App.tsx`

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './app/router';
import { queryClient } from './lib/api/query-client';

export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6:** 改 `App.test.tsx`（先简化）

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from './lib/api/query-client';
import LoginPage from './app/routes/login';

describe('LoginPage', () => {
  it('renders username/password fields', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7:** 跑测试 + lint + build

```bash
cd apps/web
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

- [ ] **Step 8:** 提交

```bash
git add apps/web/src
git commit -m "feat(web): React Router v7 + 登录页 + 受保护路由 + 占位首页"
```

---

## Task 3.7 · AppShell（Header + Nav + Outlet）

**Files:**
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Create: `apps/web/src/components/layout/Header.tsx`
- Create: `apps/web/src/components/layout/NavMenu.tsx`
- Create: `apps/web/src/components/domain/StatusChip.tsx`
- Create: `apps/web/src/components/domain/LedDot.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/routes/index.tsx`

- [ ] **Step 1:** 写 `components/domain/LedDot.tsx`

```tsx
import { cn } from '@/lib/utils';

interface LedDotProps {
  status?: 'on' | 'off' | 'pulse';
  color?: 'acc' | 'warn' | 'danger';
  className?: string;
}

export function LedDot({ status = 'pulse', color = 'acc', className }: LedDotProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-block size-1.5 rounded-full',
        color === 'acc' && 'bg-[var(--acc)]',
        color === 'warn' && 'bg-[var(--warn)]',
        color === 'danger' && 'bg-[var(--danger)]',
        status === 'pulse' && 'animate-pulse',
        status === 'off' && 'opacity-30',
        className,
      )}
      style={{ boxShadow: status !== 'off' ? 'var(--led-glow)' : undefined }}
    />
  );
}
```

- [ ] **Step 2:** 写 `components/domain/StatusChip.tsx`

```tsx
import { cn } from '@/lib/utils';
import { LedDot } from './LedDot';

interface StatusChipProps {
  label: string;
  variant?: 'default' | 'success' | 'warn' | 'danger';
  pulse?: boolean;
  className?: string;
}

export function StatusChip({
  label,
  variant = 'default',
  pulse = true,
  className,
}: StatusChipProps): React.ReactElement {
  const colorMap = { default: 'acc', success: 'acc', warn: 'warn', danger: 'danger' } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--bg-1)]/60 px-3 py-1 font-mono text-xs tracking-wider text-[var(--text-2)]',
        className,
      )}
    >
      <LedDot status={pulse ? 'pulse' : 'on'} color={colorMap[variant]} />
      <span>{label}</span>
    </span>
  );
}
```

- [ ] **Step 3:** 写 `components/layout/NavMenu.tsx`

```tsx
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
```

- [ ] **Step 4:** 写 `components/layout/Header.tsx`

```tsx
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { StatusChip } from '@/components/domain/StatusChip';
import { NavMenu } from './NavMenu';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { Button } from '@/components/ui/button';

export function Header(): React.ReactElement {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="size-7 rounded-lg bg-gradient-conic from-[var(--acc)] via-[var(--acc-2)] to-[var(--acc)]" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">天平称重系统</span>
          <span className="font-mono text-[10px] tracking-widest text-[var(--text-3)]">SCALE-SYSTEM</span>
        </div>
        <NavMenu />
      </div>
      <div />
      <div className="flex items-center gap-3">
        <StatusChip label="实时同步" variant="success" />
        <ThemeToggle />
        <span className="text-xs text-[var(--text-2)]">{user?.username}</span>
        <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
          退出
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 5:** 写 `components/layout/AppShell.tsx`

```tsx
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
```

- [ ] **Step 6:** 改 `app/router.tsx` 让登录后路由用 AppShell

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from './routes/login';
import HomePage from './routes/index';
import NotFoundPage from './routes/not-found';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [{ path: '/', element: <HomePage /> }],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
```

- [ ] **Step 7:** 简化 `routes/index.tsx`（去掉自带 header，让 AppShell 接管）

```tsx
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
```

- [ ] **Step 8:** 跑全部检查

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

- [ ] **Step 9:** 提交

```bash
git add apps/web/src
git commit -m "feat(web): AppShell + Header + NavMenu + StatusChip + LedDot"
```

---

## Task 3.8 · Platform 检测 + SerialAdapter 接口（占位实现）

**Files:**
- Create: `apps/web/src/lib/platform.ts`
- Create: `apps/web/src/lib/serial/adapter.ts`
- Create: `apps/web/src/lib/serial/unsupported-serial.ts`
- Test: `apps/web/src/lib/platform.test.ts`

- [ ] **Step 1:** 写 `lib/serial/adapter.ts`（接口定义，按 spec §4.4）

```ts
export type SerialErrorCode =
  | 'PERMISSION_DENIED'
  | 'PORT_NOT_FOUND'
  | 'PORT_BUSY'
  | 'OPEN_FAILED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'IO_ERROR'
  | 'CLOSED_BY_DEVICE'
  | 'CANCELLED'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export interface SerialPortInfo {
  id: string;
  label: string;
  vendor?: string;
  product?: string;
}

export interface ScaleConfig {
  baudRate: number;
  dataBits: 7 | 8;
  parity: 'none' | 'even' | 'odd';
  stopBits: 1 | 2;
  flowControl: 'none' | 'hardware';
  protocolType: 'generic' | 'mettler' | 'sartorius' | 'ohaus';
  readTimeoutMs: number;
  decimalPlaces: number;
  unitDefault: 'g' | 'mg' | 'kg';
}

export interface WeightSample {
  value: number;
  unit: 'g' | 'mg' | 'kg';
  stable: boolean;
  raw: string;
  ts: number;
}

export type ConnectionState =
  | 'idle'
  | 'opening'
  | 'connected'
  | 'reading'
  | 'error'
  | 'disconnected';

export interface SerialError {
  code: SerialErrorCode;
  message: string;
}

export interface ProbeResult {
  ok: boolean;
  samples: WeightSample[];
  error?: SerialError;
}

export interface SerialAdapter {
  listPorts(): Promise<SerialPortInfo[]>;
  open(portId: string, config: ScaleConfig): Promise<void>;
  close(): Promise<void>;
  onWeight(handler: (s: WeightSample) => void): () => void;
  onStatus(handler: (s: ConnectionState) => void): () => void;
  onError(handler: (e: SerialError) => void): () => void;
  probe(portId: string, config: ScaleConfig, timeoutMs: number): Promise<ProbeResult>;
  isSupported(): boolean;
}
```

- [ ] **Step 2:** 写 `lib/serial/unsupported-serial.ts`

```ts
import type { ConnectionState, ProbeResult, ScaleConfig, SerialAdapter, SerialError, SerialPortInfo, WeightSample } from './adapter';

export class UnsupportedSerialAdapter implements SerialAdapter {
  private err: SerialError = {
    code: 'UNSUPPORTED',
    message: '当前浏览器/平台不支持串口（试 Chrome/Edge 或桌面端）',
  };

  isSupported(): boolean {
    return false;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    return [];
  }

  async open(): Promise<void> {
    throw this.err;
  }

  async close(): Promise<void> {
    /* noop */
  }

  onWeight(_: (s: WeightSample) => void): () => void {
    return () => {};
  }

  onStatus(_: (s: ConnectionState) => void): () => void {
    return () => {};
  }

  onError(handler: (e: SerialError) => void): () => void {
    queueMicrotask(() => handler(this.err));
    return () => {};
  }

  async probe(): Promise<ProbeResult> {
    return { ok: false, samples: [], error: this.err };
  }
}
```

- [ ] **Step 3:** 写 `lib/platform.ts`

```ts
import type { SerialAdapter } from './serial/adapter';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let cached: SerialAdapter | null = null;

export const getSerialAdapter = (): SerialAdapter => {
  if (cached) return cached;
  // Phase 6 替换：Tauri 时返回 TauriSerialAdapter；
  // Phase 4/5 替换：浏览器有 navigator.serial 时返回 BrowserSerialAdapter
  cached = new UnsupportedSerialAdapter();
  return cached;
};

export const __resetSerialAdapterCache = (): void => {
  cached = null;
};
```

- [ ] **Step 4:** 写测试 `lib/platform.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { __resetSerialAdapterCache, getSerialAdapter, isTauri } from './platform';

describe('platform', () => {
  it('returns unsupported adapter when neither tauri nor web serial', () => {
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(false);
  });

  it('isTauri is false in jsdom', () => {
    expect(isTauri()).toBe(false);
  });
});
```

- [ ] **Step 5:** 测试 + lint pass。

- [ ] **Step 6:** 提交

```bash
git add apps/web/src/lib/platform.ts apps/web/src/lib/serial apps/web/src/lib/platform.test.ts
git commit -m "feat(web): SerialAdapter 接口 + UnsupportedSerialAdapter 占位"
```

---

## Task 3.9 · 端到端冒烟（Playwright 接入最薄一片）

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/smoke.spec.ts`

- [ ] **Step 1:** 写 `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'chromium-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2:** 写 `tests/e2e/smoke.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('用户名')).toBeVisible();
  await expect(page.getByLabel('密码')).toBeVisible();
});

test('protected route redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 3:** 装浏览器 + 跑

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

- [ ] **Step 4:** 提交

```bash
git add apps/web/playwright.config.ts apps/web/tests
git commit -m "feat(web): Playwright 接入 + 冒烟用例（登录页 + 受保护路由）"
```

---

## Phase 3 完成标志

✅ Tailwind v4 + 主题 token 完整迁移（深/浅）
✅ Theme store + ThemeToggle + useTheme
✅ shadcn 引入：button / input / label / dialog / form / sonner
✅ Axios client 含 401 自动 refresh + ApiError
✅ TanStack Query 默认配置
✅ Auth feature：store / api / hooks / RequireAuth
✅ React Router v7 + 登录页 + 占位首页 + 404
✅ AppShell + Header + NavMenu + StatusChip + LedDot
✅ Platform 检测 + SerialAdapter 接口 + Unsupported 占位
✅ Playwright 接入 + 冒烟用例
✅ Vitest 单元测试覆盖率 ≥ 80%（除业务页占位）

---

## 下一步

合并到 main，等 Phase 1 完成后做联调（手动登录走通），再进入 Phase 4（采集页 React 复刻）。
