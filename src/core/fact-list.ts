import type {Fact} from './fact';

export type FactDebugInfo = {index: number; raw: string};

class FactList {
  private readonly _items: Fact[];
  [index: number]: Fact;

  constructor(items: Fact[]) {
    this._items = items;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          return target._items[Number(prop)];
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }

  get length(): number {
    return this._items.length;
  }

  [Symbol.iterator](): Iterator<Fact> {
    return this._items[Symbol.iterator]();
  }

  at(index: number): Fact {
    const resolved = index < 0 ? this._items.length + index : index;
    const item = this._items[resolved];
    if (item === undefined) {
      throw new Error(
        `No fact at index ${index} (found ${this._items.length})`
      );
    }
    return item;
  }

  map<T>(callback: (fact: Fact, index: number) => T): T[] {
    return this._items.map(callback);
  }

  byLanguage(language: string): Fact[];
  byLanguage(language: string, n: number): Fact;
  byLanguage(language: string, n?: number): Fact | Fact[] {
    const matches = this._items.filter((f) => f.metadata.language === language);
    if (n === undefined) {
      return matches;
    }
    const result = matches[n];
    if (result === undefined) {
      throw new Error(
        `No ${language} block at index ${n} (found ${matches.length})`
      );
    }
    return result;
  }

  debug(logToConsole: boolean = true): FactDebugInfo[] {
    const result = this._items.map((fact, index) => ({
      index,
      raw: fact.raw
    }));
    if (logToConsole) {
      for (const {index, raw} of result) {
        const quote = raw.includes('\n') ? '`' : "'";
        console.log(`${index}: ${quote}${raw}${quote}`);
      }
    }
    return result;
  }
}

export {FactList};
