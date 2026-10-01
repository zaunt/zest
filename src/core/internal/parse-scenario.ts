import MarkdownIt from 'markdown-it';
import type {Token} from 'markdown-it';
import {Fact} from '../fact';
import type {FactMetadata} from '../fact';
import {Table} from '../table';
import type {Exhibit} from '../exhibit';
import type {SectionHeading} from '../context';

type ParsedExhibit =
  | {kind: 'fact'; fact: Fact; token: Token}
  | {kind: 'table'; table: Table; token: Token};

type ParsedScenario = {
  exhibits: Exhibit[];
  facts: Fact[];
  tables: Table[];
  parsedExhibits: ParsedExhibit[];
  tokens: Token[];
  markdown: string;
  headings: SectionHeading[];
};

const md = new MarkdownIt({html: true});

type ProseState = {
  proseTag: string | undefined;
  depth: number;
};

const PROSE_CONTAINER_TAGS = new Set([
  'div',
  'section',
  'aside',
  'article',
  'p',
  'prose'
]);

const hasProseClass = (attributes: string): boolean => {
  const match = attributes.match(/\bclass\s*=\s*["']([^"']*)["']/i);
  if (!match) {
    return false;
  }
  const classes = match[1].trim().split(/\s+/);
  return classes.includes('prose');
};

const TAG_REGEX = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>/g;

const updateProseState = (html: string, state: ProseState): void => {
  TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_REGEX.exec(html)) != null) {
    const isClosing = Boolean(match[1]);
    const tagName = match[2].toLowerCase();
    const attributes = match[3];
    const isSelfClosing = attributes.trimEnd().endsWith('/');

    if (isSelfClosing) {
      continue;
    }

    if (state.proseTag === undefined) {
      if (!isClosing && PROSE_CONTAINER_TAGS.has(tagName)) {
        if (tagName === 'prose' || hasProseClass(attributes)) {
          state.proseTag = tagName;
          state.depth = 1;
        }
      }
    } else if (tagName === state.proseTag) {
      if (isClosing) {
        state.depth -= 1;
        if (state.depth <= 0) {
          state.proseTag = undefined;
          state.depth = 0;
        }
      } else {
        state.depth += 1;
      }
    }
  }
};

const extractTableFromTokens = (
  tokens: Token[],
  startIndex: number
): {table: Table; endIndex: number} => {
  const headers: string[] = [];
  const rows: string[][] = [];
  let i = startIndex + 1; // skip table_open

  // Process thead
  while (i < tokens.length && tokens[i].type !== 'thead_close') {
    if (tokens[i].type === 'th_open') {
      i++;
      if (i < tokens.length && tokens[i].type === 'inline') {
        headers.push(tokens[i].content.trim());
      }
    }
    i++;
  }
  i++; // skip thead_close

  // Process tbody
  while (i < tokens.length && tokens[i].type !== 'tbody_close') {
    if (tokens[i].type === 'tr_open') {
      const row: string[] = [];
      i++;
      while (i < tokens.length && tokens[i].type !== 'tr_close') {
        if (tokens[i].type === 'td_open') {
          i++;
          if (i < tokens.length && tokens[i].type === 'inline') {
            row.push(tokens[i].content.trim());
          }
        }
        i++;
      }
      rows.push(row);
    }
    i++;
  }
  i++; // skip tbody_close

  while (i < tokens.length && tokens[i].type !== 'table_close') {
    i++;
  }

  return {table: new Table(headers, rows), endIndex: i};
};

const FACT_OPENERS = new Set(['code_inline', 'em_open', 'strong_open']);

type TokenMeta = Record<string, unknown> & {
  fact?: Fact;
  table?: Table;
};

const extractFactsFromInline = (
  inlineToken: Token,
  exhibits: ParsedExhibit[]
): void => {
  const children = inlineToken.children ?? [];
  let insideFact = false;
  let factTextParts: string[] = [];
  let factOpenerToken: Token | undefined;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (child.type === 'code_inline') {
      if (insideFact) {
        throw new Error("Nested facts aren't supported yet.");
      }
      const fact = new Fact(child.content);

      const meta = (child.meta ?? {}) as TokenMeta;
      meta.fact = fact;
      child.meta = meta;

      exhibits.push({kind: 'fact', fact, token: child});
      continue;
    }

    if (child.type === 'em_open' || child.type === 'strong_open') {
      if (insideFact) {
        throw new Error("Nested facts aren't supported yet.");
      }
      insideFact = true;
      factTextParts = [];
      factOpenerToken = child;
      continue;
    }

    if (child.type === 'em_close' || child.type === 'strong_close') {
      if (insideFact) {
        const text = factTextParts.join('');
        const fact = new Fact(text);

        const openerMeta = (factOpenerToken!.meta ?? {}) as TokenMeta;
        openerMeta.fact = fact;
        factOpenerToken!.meta = openerMeta;

        const childMeta = (child.meta ?? {}) as TokenMeta;
        childMeta.fact = fact;
        child.meta = childMeta;

        exhibits.push({kind: 'fact', fact, token: factOpenerToken!});

        insideFact = false;
        factTextParts = [];
        factOpenerToken = undefined;
      }
      continue;
    }

    if (insideFact) {
      if (FACT_OPENERS.has(child.type)) {
        throw new Error("Nested facts aren't supported yet.");
      }
      if (child.type === 'text') {
        factTextParts.push(child.content);
      } else if (child.type === 'softbreak') {
        factTextParts.push('\n');
      }
    }
  }
};

type RawHeading = {
  level: number;
  text: string;
  exhibitStartIndex: number;
};

const extractHeadingInfo = (token: Token): {level: number} | undefined => {
  if (token.type === 'heading_open') {
    const level = parseInt(token.tag.slice(1), 10);
    return {level};
  }
  return undefined;
};

const computeHeadings = (
  rawHeadings: RawHeading[],
  totalExhibits: number
): SectionHeading[] => {
  const headings: SectionHeading[] = [];

  for (let i = 0; i < rawHeadings.length; i++) {
    const raw = rawHeadings[i];
    let endIndex = totalExhibits;

    for (let j = i + 1; j < rawHeadings.length; j++) {
      if (rawHeadings[j].level <= raw.level) {
        endIndex = rawHeadings[j].exhibitStartIndex;
        break;
      }
    }

    headings.push({
      level: raw.level,
      text: raw.text,
      exhibitStartIndex: raw.exhibitStartIndex,
      exhibitEndIndex: endIndex
    });
  }

  return headings;
};

const parseScenario = (markdown: string): ParsedScenario => {
  const normalised = markdown.replace(/\r\n/g, '\n');
  const tokens = md.parse(normalised, {});
  const parsedExhibits: ParsedExhibit[] = [];
  const rawHeadings: RawHeading[] = [];
  const proseState: ProseState = {
    proseTag: undefined,
    depth: 0
  };

  let pendingHeadingLevel: number | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'html_block') {
      updateProseState(token.content, proseState);
      continue;
    }

    const insideProse = proseState.proseTag !== undefined;

    // Lists: throw immediately outside prose blocks
    if (
      token.type === 'bullet_list_open' ||
      token.type === 'ordered_list_open'
    ) {
      if (!insideProse) {
        throw new Error("Zest doesn't support lists yet.");
      }
      continue;
    }

    // Headings
    const headingInfo = extractHeadingInfo(token);
    if (headingInfo) {
      if (!insideProse) {
        pendingHeadingLevel = headingInfo.level;
      }
      continue;
    }

    if (pendingHeadingLevel !== undefined && token.type === 'inline') {
      rawHeadings.push({
        level: pendingHeadingLevel,
        text: token.content.trim(),
        exhibitStartIndex: parsedExhibits.length
      });
      pendingHeadingLevel = undefined;
      continue;
    }

    if (token.type === 'heading_close') {
      pendingHeadingLevel = undefined;
      continue;
    }

    // Tables
    if (token.type === 'table_open') {
      const {table, endIndex} = extractTableFromTokens(tokens, i);
      if (!insideProse) {
        const meta = (token.meta ?? {}) as TokenMeta;
        meta.table = table;
        token.meta = meta;
        parsedExhibits.push({kind: 'table', table, token});
      }
      i = endIndex;
      continue;
    }

    // Code blocks (fenced and indented)
    if (token.type === 'fence' || token.type === 'code_block') {
      if (insideProse) {
        continue;
      }
      const metadata: FactMetadata = {};
      if (token.type === 'fence' && token.info && token.info.trim() !== '') {
        metadata.language = token.info.trim();
      }
      const fact = new Fact(token.content, metadata);
      const meta = (token.meta ?? {}) as TokenMeta;
      meta.fact = fact;
      token.meta = meta;
      parsedExhibits.push({kind: 'fact', fact, token});
      continue;
    }

    // Inline tokens
    if (token.type === 'inline') {
      if (token.children) {
        for (const child of token.children) {
          if (child.type === 'html_inline') {
            updateProseState(child.content, proseState);
          }
        }
      }
      if (!insideProse && proseState.proseTag === undefined) {
        extractFactsFromInline(token, parsedExhibits);
      }
    }
  }

  const headings = computeHeadings(rawHeadings, parsedExhibits.length);

  const exhibits: Exhibit[] = parsedExhibits.map((pe) =>
    pe.kind === 'fact' ? pe.fact : pe.table
  );
  const facts: Fact[] = parsedExhibits
    .filter((pe) => pe.kind === 'fact')
    .map((pe) => pe.fact);
  const tables: Table[] = parsedExhibits
    .filter((pe) => pe.kind === 'table')
    .map((pe) => pe.table);

  return {
    exhibits,
    facts,
    tables,
    parsedExhibits,
    tokens,
    markdown: normalised,
    headings
  };
};

export {parseScenario};
export type {ParsedScenario, ParsedExhibit};
