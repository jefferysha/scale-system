/**
 * 三种天平协议的字节流→WeightSample 解析（移植自 apps/api/src/scale_api/serial/protocol_parser.py）。
 *
 * 线协议参考：
 *  - mettler  : `S S  168.4521 g\r\n` / `S D  168.45 g\r\n`  (S=stable, D=dynamic)
 *  - sartorius: `+ 168.4521 g \r\n` / `?  168.4521 g \r\n`     (?=unstable)
 *  - generic  : 任何形如 `[+-]?d+(.d+)?\s*(g|mg|kg)` 的行；stable 由上层时序判定
 *
 * 每个解析器是 incremental state machine：feed(chunk) → 样本数组，未完整行存于 buffer。
 */

import type { WeightSample } from './adapter';

type Unit = WeightSample['unit'];
export type ProtocolType = 'generic' | 'mettler' | 'sartorius' | 'ohaus';

const VALID_UNITS = new Set<Unit>(['g', 'mg', 'kg']);
const TEXT_DECODER = new TextDecoder('latin1');

const LINE_TERMINATORS: ReadonlyArray<readonly number[]> = [
  [0x0d, 0x0a], // \r\n
  [0x0a], // \n
  [0x0d], // \r
];

function indexOfBytes(buf: Uint8Array, needle: readonly number[]): number {
  outer: for (let i = 0; i + needle.length <= buf.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export abstract class ProtocolParser {
  protected buffer: Uint8Array = new Uint8Array(0);

  constructor(protected readonly defaultUnit: Unit = 'g') {}

  feed(chunk: Uint8Array): WeightSample[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const out: WeightSample[] = [];
    while (true) {
      const ext = this.extractLine();
      if (!ext) break;
      const sample = this.parseLine(ext);
      if (sample) out.push(sample);
    }
    return out;
  }

  protected abstract parseLine(line: string): WeightSample | null;

  private extractLine(): string | null {
    let bestIdx = -1;
    let bestTermLen = 0;
    for (const term of LINE_TERMINATORS) {
      const idx = indexOfBytes(this.buffer, term);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
        bestTermLen = term.length;
      }
    }
    if (bestIdx === -1) return null;
    const lineBytes = this.buffer.slice(0, bestIdx);
    this.buffer = this.buffer.slice(bestIdx + bestTermLen);
    return TEXT_DECODER.decode(lineBytes);
  }

  protected makeSample(value: number, unit: Unit, stable: boolean, raw: string): WeightSample {
    return { value, unit, stable, raw, ts: Date.now() };
  }
}

const RE_METTLER = /^\s*S?\s*([SD])\s+([+-]?\d+(?:\.\d+)?)\s*(g|mg|kg)\s*$/i;

export class MettlerParser extends ProtocolParser {
  protected parseLine(line: string): WeightSample | null {
    const text = line.trim();
    if (!text) return null;
    const m = RE_METTLER.exec(text);
    if (!m) return null;
    const status = m[1] ?? '';
    const valueStr = m[2] ?? '';
    const unit = (m[3] ?? '').toLowerCase() as Unit;
    if (!VALID_UNITS.has(unit)) return null;
    return this.makeSample(Number(valueStr), unit, status.toUpperCase() === 'S', text);
  }
}

const RE_SARTORIUS = /^\s*([-+?G])?\s*([+-]?\d+(?:\.\d+)?)\s*(g|mg|kg)\s*$/i;

export class SartoriusParser extends ProtocolParser {
  protected parseLine(line: string): WeightSample | null {
    const text = line.trim();
    if (!text) return null;
    const m = RE_SARTORIUS.exec(text);
    if (!m) return null;
    const prefix = m[1];
    const valueStr = m[2] ?? '';
    const unit = (m[3] ?? '').toLowerCase() as Unit;
    if (!VALID_UNITS.has(unit)) return null;
    return this.makeSample(Number(valueStr), unit, prefix !== '?', text);
  }
}

const RE_GENERIC = /^[^\d+-]*([+-]?\d+(?:\.\d+)?)\s*(g|mg|kg)?.*$/i;

export class GenericParser extends ProtocolParser {
  protected parseLine(line: string): WeightSample | null {
    const text = line.trim();
    if (!text) return null;
    const m = RE_GENERIC.exec(text);
    if (!m) return null;
    const valueStr = m[1] ?? '';
    const unit = (m[2]?.toLowerCase() as Unit | undefined) ?? this.defaultUnit;
    if (!VALID_UNITS.has(unit)) return null;
    return this.makeSample(Number(valueStr), unit, true, text);
  }
}

export function makeParser(protocolType: ProtocolType, defaultUnit: Unit = 'g'): ProtocolParser {
  switch (protocolType) {
    case 'mettler':
      return new MettlerParser(defaultUnit);
    case 'sartorius':
      return new SartoriusParser(defaultUnit);
    case 'generic':
    case 'ohaus':
    default:
      return new GenericParser(defaultUnit);
  }
}
