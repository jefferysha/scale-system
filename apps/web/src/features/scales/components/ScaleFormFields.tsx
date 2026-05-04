import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectBox, type SelectOption } from '@/components/ui/select-box';
import { Textarea } from '@/components/ui/textarea';
import type { ScaleFormValues } from './scale-form-schema';

interface Props {
  form: UseFormReturn<ScaleFormValues>;
  /** 'basic' = 名称/型号/备注/启用；'serial' = 串口与协议参数 */
  group: 'basic' | 'serial';
}

const PROTOCOL_OPTIONS: SelectOption[] = [
  { value: 'generic', label: 'generic' },
  { value: 'mettler', label: 'mettler' },
  { value: 'sartorius', label: 'sartorius' },
];
const DATA_BITS_OPTIONS: SelectOption[] = [
  { value: '7', label: '7' },
  { value: '8', label: '8' },
];
const PARITY_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'none' },
  { value: 'odd', label: 'odd' },
  { value: 'even', label: 'even' },
];
const STOP_BITS_OPTIONS: SelectOption[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
];
const FLOW_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'none' },
  { value: 'rtscts', label: 'rtscts' },
  { value: 'xonxoff', label: 'xonxoff' },
];
const UNIT_OPTIONS: SelectOption[] = [
  { value: 'g', label: 'g' },
  { value: 'mg', label: 'mg' },
  { value: 'kg', label: 'kg' },
];

/**
 * 拆成两组：组件按 group prop 分别渲染左右两栏，
 * 让 ScaleForm 能用 `<div class="grid grid-cols-2">` 排成两栏 modal 布局。
 */
export function ScaleFormFields({ form, group }: Props): React.ReactElement {
  const { register, formState, watch, setValue } = form;
  const e = formState.errors;

  if (group === 'basic') {
    const isActive = watch('is_active');
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="scale-name">名称</Label>
          <Input id="scale-name" {...register('name')} />
          {e.name && <p className="text-xs text-[var(--danger)]">{e.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scale-model">型号</Label>
          <Input id="scale-model" {...register('model')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scale-protocol">协议类型</Label>
          <SelectBox
            id="scale-protocol"
            value={watch('protocol_type')}
            options={PROTOCOL_OPTIONS}
            onChange={(v) =>
              setValue('protocol_type', v as ScaleFormValues['protocol_type'], { shouldDirty: true })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scale-notes">备注</Label>
          <Textarea id="scale-notes" rows={3} {...register('notes')} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
          <input
            type="checkbox"
            className="size-4 accent-[var(--acc)]"
            checked={!!isActive}
            onChange={(ev) => setValue('is_active', ev.target.checked, { shouldDirty: true })}
          />
          <span>启用</span>
        </label>
      </div>
    );
  }

  // group === 'serial'
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="scale-baud">波特率</Label>
        <Input id="scale-baud" type="number" {...register('baud_rate')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale-databits">数据位</Label>
        <SelectBox
          id="scale-databits"
          value={String(watch('data_bits'))}
          options={DATA_BITS_OPTIONS}
          onChange={(v) =>
            setValue('data_bits', Number(v) as ScaleFormValues['data_bits'], { shouldDirty: true })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale-parity">校验</Label>
        <SelectBox
          id="scale-parity"
          value={watch('parity')}
          options={PARITY_OPTIONS}
          onChange={(v) =>
            setValue('parity', v as ScaleFormValues['parity'], { shouldDirty: true })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale-stopbits">停止位</Label>
        <SelectBox
          id="scale-stopbits"
          value={String(watch('stop_bits'))}
          options={STOP_BITS_OPTIONS}
          onChange={(v) =>
            setValue('stop_bits', Number(v) as ScaleFormValues['stop_bits'], { shouldDirty: true })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale-flow">流控</Label>
        <SelectBox
          id="scale-flow"
          value={watch('flow_control')}
          options={FLOW_OPTIONS}
          onChange={(v) =>
            setValue('flow_control', v as ScaleFormValues['flow_control'], { shouldDirty: true })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale-timeout">读超时 ms</Label>
        <Input id="scale-timeout" type="number" {...register('read_timeout_ms')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale-decimal">小数位</Label>
        <Input id="scale-decimal" type="number" {...register('decimal_places')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale-unit">默认单位</Label>
        <SelectBox
          id="scale-unit"
          value={watch('unit_default')}
          options={UNIT_OPTIONS}
          onChange={(v) =>
            setValue('unit_default', v as ScaleFormValues['unit_default'], { shouldDirty: true })
          }
        />
      </div>
    </div>
  );
}
