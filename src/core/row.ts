import type {Codec} from './codec';
import {Fact} from './fact';

class Row {
  constructor(
    private readonly _headers: string[],
    private readonly _facts: Fact[]
  ) {}

  fact(name: string): Fact {
    const index = this._headers.indexOf(name);
    if (index < 0) {
      throw new Error(`Unknown column '${name}'.`);
    }
    return this._facts[index];
  }

  value(name: string): string;
  value<T>(name: string, codec: Codec<T>): T;
  value<T>(name: string, codec?: Codec<T>): string | T {
    const fact = this.fact(name);
    if (codec) {
      return fact.as(codec);
    }
    return fact.asString();
  }

  toObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < this._headers.length; i++) {
      result[this._headers[i]] = this._facts[i].asString();
    }
    return result;
  }
}

export {Row};
