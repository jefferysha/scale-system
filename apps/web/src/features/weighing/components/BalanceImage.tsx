import { LCDDisplay } from './LCDDisplay';

interface Props {
  digits: string;
  stable: boolean;
}

/**
 * 复刻 .balance-img-wrap：方形容器 + container-type:inline-size，
 * 让子组件可以用 cqi 单位（容器内宽度的百分比）实现精准缩放。
 * 深色主题用 #whiteKey filter 把 PNG 白底剔透。
 */
export function BalanceImage({ digits, stable }: Props): React.ReactElement {
  return (
    <div
      className="relative mx-auto flex h-full max-h-full w-auto items-center justify-center"
      style={{ aspectRatio: '1 / 1', containerType: 'inline-size' }}
    >
      <img
        src="/balance.png"
        alt="电子天平"
        draggable={false}
        className="block h-full w-full select-none object-contain pointer-events-none balance-png"
      />
      <LCDDisplay digits={digits} stable={stable} />
    </div>
  );
}
