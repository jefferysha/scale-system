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
