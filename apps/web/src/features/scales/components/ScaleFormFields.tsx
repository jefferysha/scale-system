import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ScaleFormValues } from './scale-form-schema';

interface Props {
  form: UseFormReturn<ScaleFormValues>;
}

export function ScaleFormFields({ form }: Props): React.ReactElement {
  const { register, formState } = form;
  const e = formState.errors;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2 col-span-2">
        <Label htmlFor="scale-name">名称</Label>
        <Input id="scale-name" {...register('name')} />
        {e.name && <p className="text-xs text-[var(--danger)]">{e.name.message}</p>}
      </div>
      <div className="space-y-2 col-span-2">
        <Label htmlFor="scale-model">型号</Label>
        <Input id="scale-model" {...register('model')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-protocol">协议类型</Label>
        <Select id="scale-protocol" {...register('protocol_type')}>
          <option value="generic">generic</option>
          <option value="mettler">mettler</option>
          <option value="sartorius">sartorius</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-baud">波特率</Label>
        <Input id="scale-baud" type="number" {...register('baud_rate')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-databits">数据位</Label>
        <Select id="scale-databits" {...register('data_bits')}>
          <option value={7}>7</option>
          <option value={8}>8</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-parity">校验</Label>
        <Select id="scale-parity" {...register('parity')}>
          <option value="none">none</option>
          <option value="odd">odd</option>
          <option value="even">even</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-stopbits">停止位</Label>
        <Select id="scale-stopbits" {...register('stop_bits')}>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-flow">流控</Label>
        <Select id="scale-flow" {...register('flow_control')}>
          <option value="none">none</option>
          <option value="rtscts">rtscts</option>
          <option value="xonxoff">xonxoff</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-timeout">读超时 ms</Label>
        <Input id="scale-timeout" type="number" {...register('read_timeout_ms')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-decimal">小数位</Label>
        <Input id="scale-decimal" type="number" {...register('decimal_places')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scale-unit">默认单位</Label>
        <Select id="scale-unit" {...register('unit_default')}>
          <option value="g">g</option>
          <option value="mg">mg</option>
          <option value="kg">kg</option>
        </Select>
      </div>
      <div className="space-y-2 col-span-2">
        <Label htmlFor="scale-notes">备注</Label>
        <Textarea id="scale-notes" rows={2} {...register('notes')} />
      </div>
      <div className="col-span-2 flex items-center gap-2">
        <input
          id="scale-active"
          type="checkbox"
          className="size-4 accent-[var(--acc)]"
          {...register('is_active')}
        />
        <Label htmlFor="scale-active">启用</Label>
      </div>
    </div>
  );
}
