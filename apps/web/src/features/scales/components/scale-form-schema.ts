import { z } from 'zod';

export const scaleSchema = z.object({
  name: z.string().min(1).max(64),
  model: z.string().nullable().optional(),
  protocol_type: z.enum(['generic', 'mettler', 'sartorius']),
  baud_rate: z.coerce.number().int().positive(),
  data_bits: z.coerce.number().int().min(7).max(8),
  parity: z.enum(['none', 'odd', 'even']),
  stop_bits: z.coerce.number().int().min(1).max(2),
  flow_control: z.enum(['none', 'rtscts', 'xonxoff']),
  read_timeout_ms: z.coerce.number().int().min(50).max(60000),
  decimal_places: z.coerce.number().int().min(0).max(6),
  unit_default: z.enum(['g', 'mg', 'kg']),
  notes: z.string().nullable().optional(),
  is_active: z.boolean(),
});

export type ScaleFormValues = z.infer<typeof scaleSchema>;
