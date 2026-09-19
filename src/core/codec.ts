import type {ParseResult} from './internal/parse-result';

interface Codec<T> {
  parse(text: string): ParseResult<T>;
  format(value: T): string;
}

export type {Codec};
