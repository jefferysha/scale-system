import { cn } from '@/lib/utils';

interface Props {
  digits: string;
  unit?: string;
  stable?: boolean;
  className?: string;
}

/**
 * 复刻 legacy/scale-system.html .lcd-mask：
 * - 精准盖在 balance.png 底座 LCD 屏（top 69.8% / bottom 21.8% / left 33% / right 33%）
 * - 底层 ghost "88.8888" 用极淡绿色模拟未点亮的 LCD 段位
 * - 真实读数用 #3dff85 + text-shadow 模拟 LED 发光
 * - 使用 cqi 单位让字号随容器自适应
 */
export function LCDDisplay({
  digits,
  unit = 'g',
  stable = false,
  className,
}: Props): React.ReactElement {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-[33%] right-[33%] top-[69.8%] bottom-[21.8%]',
        'flex items-center justify-center gap-[0.2em] overflow-hidden rounded-[0.6cqi]',
        'bg-[#020a06] px-[1.4cqi]',
        className,
      )}
      style={{ boxShadow: 'inset 0 0 5px rgba(0,0,0,.7)' }}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono font-extrabold leading-none tracking-[0.05em]"
        style={{
          fontSize: '4.4cqi',
          color: 'rgba(60, 255, 140, 0.05)',
        }}
      >
        88.8888
      </span>
      <span
        className="absolute left-[5%] top-1/2 -translate-y-1/2 rounded-full transition-all"
        style={{
          width: '1.2cqi',
          height: '1.2cqi',
          background: stable ? '#3dff85' : '#1a3a26',
          boxShadow: stable
            ? '0 0 4px #3dff85, 0 0 9px rgba(61,255,133,.6)'
            : 'none',
        }}
      />
      <span
        className="relative z-10 font-mono font-extrabold leading-none tracking-[0.05em]"
        style={{
          fontSize: '4.4cqi',
          color: '#3dff85',
          textShadow: '0 0 4px rgba(61,255,133,.7), 0 0 10px rgba(61,255,133,.35)',
        }}
      >
        {digits}
      </span>
      <span
        className="relative z-10 font-mono leading-none opacity-90"
        style={{
          fontSize: '2.4cqi',
          color: '#3dff85',
          textShadow: '0 0 3px rgba(61,255,133,.5)',
        }}
      >
        {unit}
      </span>
    </div>
  );
}
