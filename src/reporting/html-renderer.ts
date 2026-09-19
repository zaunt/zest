import MarkdownIt, {type Options} from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import {FactState} from '../core/fact-state';
import type {Fact} from '../core/fact';
import type {Table} from '../core/table';
import type {ParsedExhibit} from '../core/internal/parse-scenario';

const CSS = `
html {
  box-sizing: border-box;
  font-family: Arial;
  font-size: 17px;
}
*, *:before, *:after {
  box-sizing: inherit;
}
body {
  padding: 24px;
  overflow-wrap: break-word;
}
.content {
  margin: 0 auto;
  max-width: 800px;
}
table {
  border-collapse: collapse;
  border-spacing: 0;
  box-shadow: 3px 5px 7px 0px rgba(0,0,0,0.1);
  margin: 20px 0;
}
th {
  font-weight: bold;
  background-color: #e3e3e3;
  vertical-align: top;
}
td {
  background-color: #fff;
}
td, th {
  border: 1px solid #333;
  padding: 4px 6px;
}
pre, code {
  font-family: Lucida Sans Typewriter, monospace;
  font-size: 0.9rem;
  line-height: 1.4rem;
}
pre {
  padding: 10px 16px !important;
  background-color: #f3f3f3;
}
p {
  line-height: 1.5rem;
}
.prose, prose {
  margin: 16px 0;
}
.prose ul, .prose ol, prose ul, prose ol {
  padding-left: 24px;
  margin: 12px 0;
}
.prose li, prose li {
  line-height: 1.5rem;
  margin-bottom: 4px;
}
.SUCCESS, .FAILURE {
  padding: 2px 5px;
  border-radius: 5px;
}
table .SUCCESS, table .FAILURE {
  border-radius: 0;
}
.SUCCESS {
  background-color: rgba(0,255,20, 0.3);
}
.FAILURE {
  background-color: rgba(255, 64, 40, 0.3);
}
.FAILURE ins {
  background-color: #def3ff;
  font-weight: bold;
  text-decoration: none;
  padding: 2px 1px;
  margin: 0 -1px;
}
.FAILURE del {
  background-color: #f36b6b;
  font-weight: bold;
  text-decoration: line-through;
  text-decoration-thickness: 2px;
  padding: 2px 1px;
  margin: 0 -1px;
}
pre code.SUCCESS, pre code.FAILURE {
  padding-left: 0;
  padding-right: 0;
}
.NOT_CHECKED {
  background-color: #ddf7f6;
}
.NOT_USED {
  xbackground-color: #eaeaea;
  color: #777;
}
`;

const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') {
    throw new TypeError(
      `Expected a string, got ${typeof text}. Maybe you need a codec?`
    );
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const renderFactContent = (fact: Fact): string => {
  const raw = escapeHtml(fact.raw);
  if (fact.state === FactState.FAILURE && fact.actualText !== undefined) {
    return `<del>${raw}</del><ins>${escapeHtml(fact.actualText)}</ins>`;
  }
  return raw;
};

const renderTableHtml = (table: Table): string => {
  const lines: string[] = [];
  lines.push('<table>');
  lines.push('<thead>');
  lines.push('<tr>');
  for (const headerFact of table.headerFacts) {
    lines.push(
      `<th class="${headerFact.state}">${renderFactContent(headerFact)}</th>`
    );
  }
  lines.push('</tr>');
  lines.push('</thead>');
  lines.push('<tbody>');
  for (const cellRow of table.cellFacts) {
    lines.push('<tr>');
    for (const cellFact of cellRow) {
      lines.push(
        `<td class="${cellFact.state}">${renderFactContent(cellFact)}</td>`
      );
    }
    lines.push('</tr>');
  }
  lines.push('</tbody>');
  lines.push('</table>');
  return lines.join('\n');
};

function hasFactMeta(meta: unknown): meta is {fact?: unknown} {
  return typeof meta === 'object' && meta != null && 'fact' in meta;
}

const findSuppressedTokens = (tokens: Token[]): Set<Token> => {
  const suppressed = new Set<Token>();
  for (const token of tokens) {
    if (token.type !== 'inline') {
      continue;
    }
    const children = token.children ?? [];
    let insideFact = false;
    for (const child of children) {
      if (
        (child.type === 'em_open' || child.type === 'strong_open') &&
        hasFactMeta(child.meta) &&
        child.meta.fact
      ) {
        insideFact = true;
        continue;
      }
      if (
        (child.type === 'em_close' || child.type === 'strong_close') &&
        hasFactMeta(child.meta) &&
        child.meta.fact
      ) {
        insideFact = false;
        continue;
      }
      if (insideFact) {
        suppressed.add(child);
      }
    }
  }
  return suppressed;
};

const renderHtml = (
  name: string,
  _markdown: string,
  tokens: Token[],
  parsedExhibits: ParsedExhibit[]
): string => {
  const md = new MarkdownIt();
  const suppressed = findSuppressedTokens(tokens);

  const tableExhibits = parsedExhibits.filter(
    (e): e is {kind: 'table'; table: Table; token: Token} => e.kind === 'table'
  );
  let tableIndex = 0;
  let insideReplacedTable = false;

  md.renderer.rules.text = (toks, idx): string => {
    if (insideReplacedTable || suppressed.has(toks[idx])) {
      return '';
    }
    return escapeHtml(toks[idx].content);
  };

  md.renderer.rules.softbreak = (toks, idx): string => {
    if (insideReplacedTable || suppressed.has(toks[idx])) {
      return '';
    }
    return '\n';
  };

  md.renderer.rules.code_inline = (toks, idx): string => {
    if (insideReplacedTable) {
      return '';
    }
    const token = toks[idx];
    const fact: Fact | undefined =
      hasFactMeta(token.meta) ? (token.meta.fact as Fact) : undefined;
    if (fact) {
      return `<code class="${fact.state}">${renderFactContent(fact)}</code>`;
    }
    return `<code>${escapeHtml(token.content)}</code>`;
  };

  md.renderer.rules['em_open'] = (toks, idx, _opts, _env, slf): string => {
    if (insideReplacedTable) {
      return '';
    }
    const token = toks[idx];
    const fact: Fact | undefined =
      hasFactMeta(token.meta) ? (token.meta.fact as Fact) : undefined;
    if (fact) {
      return `<em class="${fact.state}">${renderFactContent(fact)}`;
    }
    return '<em' + slf.renderAttrs(token) + '>';
  };

  md.renderer.rules['em_close'] = (): string => {
    if (insideReplacedTable) {
      return '';
    }
    return '</em>';
  };

  md.renderer.rules['strong_open'] = (toks, idx, _opts, _env, slf): string => {
    if (insideReplacedTable) {
      return '';
    }
    const token = toks[idx];
    const fact: Fact | undefined =
      hasFactMeta(token.meta) ? (token.meta.fact as Fact) : undefined;
    if (fact) {
      return `<strong class="${fact.state}">${renderFactContent(fact)}`;
    }
    return '<strong' + slf.renderAttrs(token) + '>';
  };

  md.renderer.rules['strong_close'] = (): string => {
    if (insideReplacedTable) {
      return '';
    }
    return '</strong>';
  };

  md.renderer.rules.fence = (toks, idx): string => {
    const token = toks[idx];
    const fact: Fact | undefined =
      hasFactMeta(token.meta) ? (token.meta.fact as Fact) : undefined;
    if (fact) {
      return `<pre><code class="${fact.state}">${renderFactContent(fact)}</code></pre>\n`;
    }
    const langClass =
      token.info && token.info.trim() ?
        ` class="language-${escapeHtml(token.info.trim())}"`
      : '';
    return `<pre><code${langClass}>${escapeHtml(token.content)}</code></pre>\n`;
  };

  md.renderer.rules.code_block = (toks, idx): string => {
    const token = toks[idx];
    const fact: Fact | undefined =
      hasFactMeta(token.meta) ? (token.meta.fact as Fact) : undefined;
    if (fact) {
      return `<pre><code class="${fact.state}">${renderFactContent(fact)}</code></pre>\n`;
    }
    return `<pre><code>${escapeHtml(token.content)}</code></pre>\n`;
  };

  md.renderer.rules['table_open'] = (): string => {
    const exhibit = tableExhibits[tableIndex];
    if (exhibit) {
      insideReplacedTable = true;
      return renderTableHtml(exhibit.table);
    }
    return '<table>';
  };

  md.renderer.rules['table_close'] = (): string => {
    const wasReplaced = insideReplacedTable;
    insideReplacedTable = false;
    if (wasReplaced) {
      tableIndex++;
      return '';
    }
    return '</table>';
  };

  const suppressIfReplaced = (
    toks: Token[],
    idx: number,
    opts: Options,
    _env: unknown,
    slf: {renderToken(tokens: Token[], idx: number, options: Options): string}
  ): string => (insideReplacedTable ? '' : slf.renderToken(toks, idx, opts));

  md.renderer.rules['thead_open'] = suppressIfReplaced;
  md.renderer.rules['thead_close'] = suppressIfReplaced;
  md.renderer.rules['tbody_open'] = suppressIfReplaced;
  md.renderer.rules['tbody_close'] = suppressIfReplaced;
  md.renderer.rules['tr_open'] = suppressIfReplaced;
  md.renderer.rules['tr_close'] = suppressIfReplaced;
  md.renderer.rules['th_open'] = suppressIfReplaced;
  md.renderer.rules['th_close'] = suppressIfReplaced;
  md.renderer.rules['td_open'] = suppressIfReplaced;
  md.renderer.rules['td_close'] = suppressIfReplaced;

  const body = md.renderer.render(tokens, md.options, {});

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(name)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="content">
    ${body}
  </div>
</body>
</html>`;
};

export {renderHtml};
