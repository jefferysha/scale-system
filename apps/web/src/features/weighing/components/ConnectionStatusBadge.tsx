import { StatusChip } from '@/components/domain/StatusChip';
import type { ConnectionState } from '@/lib/serial/adapter';

const labelMap: Record<ConnectionState, string> = {
  idle: '待机',
  opening: '连接中',
  connected: '已连接',
  reading: '采集中',
  error: '错误',
  disconnected: '已断开',
};

const variantMap: Record<ConnectionState, 'default' | 'success' | 'warn' | 'danger'> = {
  idle: 'default',
  opening: 'warn',
  connected: 'success',
  reading: 'success',
  error: 'danger',
  disconnected: 'default',
};

interface Props {
  state: ConnectionState;
  className?: string;
}

export function ConnectionStatusBadge({ state, className }: Props): React.ReactElement {
  return (
    <StatusChip
      label={labelMap[state]}
      variant={variantMap[state]}
      pulse={state === 'reading' || state === 'opening'}
      className={className}
    />
  );
}
