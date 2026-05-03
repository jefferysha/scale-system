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
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<Form>({
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
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-80 space-y-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6"
      >
        <h1 className="text-xl font-semibold text-[var(--text)]">天平称重系统</h1>
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input id="username" autoComplete="username" {...register('username')} />
          {errors.username && (
            <p className="text-xs text-[var(--danger)]">{errors.username.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-[var(--danger)]">{errors.password.message}</p>
          )}
        </div>
        {errors.root && <p className="text-xs text-[var(--danger)]">{errors.root.message}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? '登录中…' : '登录'}
        </Button>
      </form>
    </main>
  );
}
