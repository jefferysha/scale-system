import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { ScaleProtocolFields } from './ScaleProtocolFields';
import type { ScaleFormValues } from './scale-form-schema';

function Harness({ overrides }: { overrides: Partial<ScaleFormValues> }) {
  const form = useForm<ScaleFormValues>({
    defaultValues: {
      name: 'X',
      model: '',
      protocol_type: 'generic',
      baud_rate: 9600,
      data_bits: 8,
      parity: 'none',
      stop_bits: 1,
      flow_control: 'none',
      read_timeout_ms: 1000,
      decimal_places: 4,
      unit_default: 'g',
      notes: '',
      is_active: true,
      ...overrides,
    },
  });
  return <ScaleProtocolFields form={form} />;
}

describe('ScaleProtocolFields', () => {
  it('mettler + stop_bits=2 显示 warning', () => {
    render(<Harness overrides={{ protocol_type: 'mettler', stop_bits: 2 }} />);
    expect(screen.getByTestId('scale-stop-warn')).toBeInTheDocument();
  });

  it('mettler + stop_bits=1 不显示 warning', () => {
    render(<Harness overrides={{ protocol_type: 'mettler', stop_bits: 1 }} />);
    expect(screen.queryByTestId('scale-stop-warn')).not.toBeInTheDocument();
  });

  it('generic 协议显示通用提示', () => {
    render(<Harness overrides={{ protocol_type: 'generic' }} />);
    expect(screen.getByTestId('scale-protocol-hint')).toHaveTextContent('通用协议');
  });
});
