import type {Exhibit} from './exhibit';
import type {Fact} from './fact';
import {FactList} from './fact-list';
import type {Table} from './table';

type SectionHeading = {
  level: number;
  text: string;
  exhibitStartIndex: number;
  exhibitEndIndex: number;
};

class Context {
  readonly facts: FactList;
  readonly tables: Table[];
  readonly exhibits: Exhibit[];

  private readonly _allExhibits: Exhibit[];
  private readonly _headings: SectionHeading[];
  private readonly _scopeStart: number;
  private readonly _scopeEnd: number;

  constructor(
    allExhibits: Exhibit[],
    headings: SectionHeading[],
    scopeStart: number,
    scopeEnd: number
  ) {
    this._allExhibits = allExhibits;
    this._headings = headings;
    this._scopeStart = scopeStart;
    this._scopeEnd = scopeEnd;

    this.exhibits = allExhibits.slice(scopeStart, scopeEnd);
    this.facts = new FactList(
      this.exhibits.filter((e): e is Fact => e.kind === 'fact')
    );
    this.tables = this.exhibits.filter((e): e is Table => e.kind === 'table');
  }

  get sectionNames(): string[] {
    return this._directChildHeadings().map((h) => h.text);
  }

  get allSectionNames(): {name: string; level: number}[] {
    return this._scopedHeadings().map((h) => ({name: h.text, level: h.level}));
  }

  section(name: string | RegExp): Context {
    const candidates = this._directChildHeadings();

    const matches =
      typeof name === 'string' ?
        candidates.filter((h) => h.text === name)
      : candidates.filter((h) => name.test(h.text));

    if (matches.length === 0) {
      const label = typeof name === 'string' ? `"${name}"` : `${name}`;
      throw new Error(
        `No section found matching ${label}. Available sections: ${candidates.map((h) => `"${h.text}"`).join(', ') || '(none)'}`
      );
    }

    if (matches.length > 1) {
      const label = typeof name === 'string' ? `"${name}"` : `${name}`;
      throw new Error(
        `Multiple sections match ${label}: ${matches.map((h) => `"${h.text}"`).join(', ')}`
      );
    }

    const heading = matches[0];
    return new Context(
      this._allExhibits,
      this._headings,
      heading.exhibitStartIndex,
      heading.exhibitEndIndex
    );
  }

  debug(logToConsole: boolean = true) {
    return this.facts.debug(logToConsole);
  }

  private _scopedHeadings(): SectionHeading[] {
    return this._headings.filter(
      (h) =>
        h.level !== 1 &&
        h.exhibitStartIndex >= this._scopeStart &&
        h.exhibitEndIndex <= this._scopeEnd
    );
  }

  private _directChildHeadings(): SectionHeading[] {
    const scoped = this._scopedHeadings();
    if (scoped.length === 0) {
      return [];
    }

    const result: SectionHeading[] = [];
    let currentFloor = 0;

    for (const heading of scoped) {
      if (currentFloor === 0 || heading.level <= currentFloor) {
        result.push(heading);
        currentFloor = heading.level;
      }
    }

    return result;
  }
}

export {Context};
export type {SectionHeading};
