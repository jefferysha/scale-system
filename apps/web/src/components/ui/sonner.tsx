import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

const Toaster = ({ ...props }: ToasterProps): React.ReactElement => {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[var(--bg-1)] group-[.toaster]:text-[var(--text)] group-[.toaster]:border-[var(--line-2)] group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[var(--text-2)]',
          actionButton: 'group-[.toast]:bg-[var(--acc)] group-[.toast]:text-[var(--bg-0)]',
          cancelButton: 'group-[.toast]:bg-[var(--bg-2)] group-[.toast]:text-[var(--text-2)]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
