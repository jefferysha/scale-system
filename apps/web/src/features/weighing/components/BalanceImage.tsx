import { LCDDisplay } from './LCDDisplay';

interface Props {
  digits: string;
  stable: boolean;
}

export function BalanceImage({ digits, stable }: Props): React.ReactElement {
  return (
    <div className="relative grid place-items-center">
      <img
        src="/balance.png"
        alt="电子天平"
        className="max-h-[420px] w-auto select-none"
        draggable={false}
      />
      <LCDDisplay digits={digits} stable={stable} />
    </div>
  );
}
