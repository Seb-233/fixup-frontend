import { Pipe, PipeTransform } from '@angular/core';
import * as f from '../format';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return f.money(value);
  }
}

@Pipe({ name: 'day' })
export class DayPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, style: 'long' | 'short' = 'long'): string {
    return style === 'short' ? f.dateShort(value) : f.date(value);
  }
}

@Pipe({ name: 'when' })
export class WhenPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return f.dateTime(value);
  }
}

@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return f.relative(value);
  }
}

@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(key: string | null | undefined, map: Record<string, string>): string {
    return f.name(map, key);
  }
}

export const FORMAT_PIPES = [MoneyPipe, DayPipe, WhenPipe, AgoPipe, LabelPipe] as const;
