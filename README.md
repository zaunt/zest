# @zaunt/zest

A scenario-based testing framework for TypeScript. Write tests as natural-language Markdown with embedded facts and tables, and let Zest extract, parse, and assert them for you.

Zest produces colour-coded HTML reports showing which facts passed, failed, or weren't checked.

## Installation

```bash
npm install --save-dev @zaunt/zest
```

Zest currently integrates with [Vitest](https://vitest.dev/). You'll need Vitest installed as well.

## Quick start

```ts
import {scenario, eachRow, stringCodec, intCodec} from '@zaunt/zest';

scenario({
  markdown: 'When made uppercase `fred` becomes `FRED`.',
  execute({facts: [input]}) {
    return input.asString().toUpperCase();
  }
});
```

Zest extracts `fred` and `FRED` as facts, passes them via the `execute` argument, and compares the return value against the last fact.

## Core concepts

### Exhibits, facts, and tables

Zest extracts **exhibits** from the Markdown in document order. An exhibit is either a `Fact` or a `Table`.

**Facts** (`kind: 'fact'`) come from:

- Backtick-wrapped text: `` `value` ``
- Bold text: `**value**`
- Italic text: `*value*`
- Fenced code blocks (with or without a language tag)
- Indented code blocks

All of these produce a single string value. Leading and trailing blank lines are trimmed, but internal whitespace is preserved. Code block facts have a `metadata` property: `{ language: 'ts' }` for fenced blocks with a language tag, or `{}` otherwise. Non-code-block facts always have `metadata: {}`.

**Tables** (`kind: 'table'`) come from GFM Markdown tables. Cell content is plain text — backticks, bold, and italic inside cells don't produce separate facts.

**Restrictions:** Nested facts (e.g. ``**`value`**``) throw an error. Lists (bulleted or numbered) throw an error; they're reserved for future use.

### Codecs

A codec converts between strings and typed values. Zest provides several built-in codecs:

| Codec                                           | Description                                  |
| ----------------------------------------------- | -------------------------------------------- |
| `stringCodec`                                   | Identity — no conversion                     |
| `intCodec`                                      | Parses/formats integers                      |
| `floatCodec(fractionDigits?)`                   | Parses/formats floating-point numbers        |
| `booleanCodec(truthy?, falsy?, ignoreCase?)`    | Defaults to `'yes'`/`'no'`, case-insensitive |
| `enumCodec(values, ignoreCase?)`                | Matches against a set of string literals     |
| `mappedCodec(parseMap, formatMap, ignoreCase?)` | Arbitrary string↔value mapping               |

Use codecs to read typed values from facts:

```ts
fact.asString(); // string
fact.asInt(); // number (integer)
fact.as(floatCodec(2)); // number (float)
```

## Writing scenarios

### The `execute` function

The `execute` function receives a `Context` object with three properties, all in document order:

- `facts: FactList` — all facts extracted from the Markdown.
- `tables: Table[]` — all tables extracted from the Markdown.
- `exhibits: Exhibit[]` — all exhibits (facts and tables interleaved).

These are views over the same underlying objects, not copies.

`FactList` is iterable and supports destructuring, so you can write `execute({facts: [a, b]})` for simple cases. For scenarios with many facts, it also supports indexed access and language-based filtering (see below).

### Accessing facts by section

When a scenario has multiple sections under different headings, positional fact indices can become hard to follow. The `Context` object's `section` method lets you scope into a heading's content instead.

A section is everything underneath a heading up to the next heading at the same level or higher. The returned object is itself a `Context`, with its own `facts`, `tables`, `exhibits`, and `section` method — so you can drill down through nested headings.

```ts
scenario({
  name: 'createProdViteAssetTagsService',
  markdown: `
# createProdViteAssetTagsService()

Given this manifest:

\`\`\`json
{ "src/app.ts": { "file": "js/app.js", "css": ["css/app.css"] } }
\`\`\`

## Entry with CSS

Requesting entry \`src/app.ts\` produces:

\`\`\`html
<link rel="stylesheet" href="/css/app.css" />
<script type="module" src="/js/app.js"></script>
\`\`\`

## Custom base path

Using base path \`/static/\` for entry \`src/app.ts\` produces:

\`\`\`html
<script type="module" src="/static/js/app.js"></script>
\`\`\`
`,
  async execute(context) {
    const manifest = JSON.parse(context.facts.json(0).asString());
    const defaultService = createProdViteAssetTagsService(manifest);

    const {
      facts: [entry, expected]
    } = context.section('Entry with CSS');
    expected.assertEquals(await defaultService(entry.asString()));

    const {
      facts: [basePath, customEntry, customExpected]
    } = context.section('Custom base path');
    const customService = createProdViteAssetTagsService(
      manifest,
      basePath.asString()
    );
    customExpected.assertEquals(await customService(customEntry.asString()));
  }
});
```

`section` accepts either an exact string or a regular expression. It throws if no heading matches, or if multiple headings match — there must be exactly one unambiguous match.

#### Discovering sections programmatically

`Context` exposes two properties for inspecting available sections:

- `sectionNames` — the heading texts of the immediate child sections within the current scope. A heading is an "immediate child" if no shallower heading (ignoring `h1`) sits between the scope start and that heading. For example, if `### Foo` appears before any `##` heading, both are immediate children of the root scope.
- `allSectionNames` — all descendant headings within the scope (excluding `h1`), in document order, each with its `name` and `level`.

```ts
scenario({
  markdown: `
# My service

### Setup
\`config-value\`

## Addition
Input: \`3\`, output: \`6\`

## Subtraction
Input: \`10\`, output: \`7\`

### Edge case
Input: \`0\`, output: \`-3\`
`,
  execute(context) {
    // context.sectionNames → ['Setup', 'Addition', 'Subtraction']
    // context.allSectionNames → [
    //   { name: 'Setup', level: 3 },
    //   { name: 'Addition', level: 2 },
    //   { name: 'Subtraction', level: 2 },
    //   { name: 'Edge case', level: 3 },
    // ]

    const sub = context.section('Subtraction');
    // sub.sectionNames → ['Edge case']
    // sub.facts contains the facts from both '## Subtraction' and '### Edge case'
  }
});
```

### Accessing facts by language

When your Markdown contains several code blocks with language tags, positional destructuring can become unwieldy. `FactList` lets you filter by language instead:

```ts
scenario({
  markdown: `
Given this config:

\`\`\`json
{"port": 3000}
\`\`\`

It produces:

\`\`\`yaml
port: 3000
\`\`\`
`,
  execute({facts}) {
    const config = JSON.parse(facts.json(0).asString());
    facts.byLanguage('yaml', 0).assertEquals(toYaml(config));
  }
});
```

`facts.json(0)` returns the first JSON code block, `facts.html(2)` returns the third HTML block, and so on. You can get facts by their language tag, using e.g. `facts.byLanguage('python', 0)`.

These methods throw if the requested block doesn't exist, with a message indicating how many blocks of that language were found.

### Simple assertion by return value

If `execute` returns a non-undefined value, Zest compares it to the **last fact** using the `result` codec (which defaults to `stringCodec`).

```ts
scenario({
  markdown: 'The result of `3` + `4` is `7`.',
  result: intCodec,
  execute({facts: [a, b]}) {
    return a.asInt() + b.asInt();
  }
});
```

### Manual assertions

Instead of returning a result, you can assert facts manually using `assertEquals`.

```ts
scenario({
  name: 'Boolean negation',
  markdown: 'The input is `Aye` the output is `Nay`.',
  execute({facts: [input, output]}) {
    const codec = booleanCodec('Aye', 'Nay');
    output.assertEquals(!input.as(codec), codec);
  }
});
```

Each fact can only be asserted once.

### Tables

Tables in the Markdown are available via the `tables` array.

```ts
scenario({
  markdown: `
Input   | Result
--------|--------
foo     | FOO
bar     | BAR
`,
  execute({tables: [table]}) {
    for (const row of table) {
      row.fact('Result').assertEquals(row.value('Input').toUpperCase());
    }
  }
});
```

### Multiple tables and inline facts

Tables and inline facts are interleaved in document order. You can mix setup data, test cases, and assertions freely.

```ts
scenario({
  markdown: `
Name   | Age
-------|------
Fred   | 35
Wilma  | 33

Input      | Expected
-----------|----------
fred       | FRED
wilma      | WILMA

The author is *Betty*.
`,
  execute({facts: [author], tables: [people, testCases]}) {
    const map = people.toMap({Age: intCodec});
    // map = { "Fred": 35, "Wilma": 33 }

    for (const row of testCases) {
      row.fact('Expected').assertEquals(row.value('Input').toUpperCase());
    }

    author.assertEquals('Betty');
  }
});
```

### Code block facts

Code blocks are treated as single-string facts, not parsed for tables or other exhibits.

```ts
scenario({
  markdown: `
The template produces:

\`\`\`html
<div>
  <p>Hello</p>
</div>
\`\`\`
`,
  execute({facts: [output]}) {
    // output.metadata is { language: 'html' }
    return renderTemplate();
  }
});
```

## API reference

### `Context`

The `execute` function receives a `Context` object. It has the same `facts`, `tables`, and `exhibits` properties as previous versions' `ExecuteArgs`, so all existing destructuring patterns continue to work.

| Method / Property         | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `context.facts`           | `FactList` — all facts in the current scope                 |
| `context.tables`          | `Table[]` — all tables in the current scope                 |
| `context.exhibits`        | `Exhibit[]` — all exhibits in the current scope             |
| `context.section(name)`   | Returns a `Context` scoped to the named section             |
| `context.section(regex)`  | Same, but matches heading text against a regular expression |
| `context.sectionNames`    | `string[]` — heading texts of the immediate child sections  |
| `context.allSectionNames` | `{name: string, level: number}[]` — all descendant headings |

`section` throws if no heading matches or if multiple headings match. Heading level 1 is ignored for section scoping (there should be at most one, covering the entire scenario).

### `FactList`

| Method / Property           | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `facts.length`              | Number of facts                                    |
| `facts.at(index)`           | Fact by 0-based index (throws if out of bounds)    |
| `facts.byLanguage(lang, n)` | The *n*th code block with the given language tag   |
| `facts.json(n)`             | Shorthand for `byLanguage('json', n)`              |
| `facts.html(n)`             | Shorthand for `byLanguage('html', n)`              |
| `facts.css(n)`              | Shorthand for `byLanguage('css', n)`               |
| `facts.js(n)`               | Shorthand for `byLanguage('js', n)`                |
| `facts.ts(n)`               | Shorthand for `byLanguage('ts', n)`                |
| `facts.xml(n)`              | Shorthand for `byLanguage('xml', n)`               |
| `facts.sql(n)`              | Shorthand for `byLanguage('sql', n)`               |
| `for (const f of facts)`    | Iterable — works with destructuring and `for...of` |

`FactList` supports destructuring (e.g. `{facts: [a, b]}`).

### `Fact`

| Method / Property                  | Description                                    |
| ---------------------------------- | ---------------------------------------------- |
| `fact.asString()`                  | Returns the raw string value                   |
| `fact.asInt()`                     | Parses as integer                              |
| `fact.as(codec)`                   | Parses with a codec                            |
| `fact.assertEquals(actual)`        | Asserts equality using `stringCodec`           |
| `fact.assertEquals(actual, codec)` | Asserts equality using the given codec         |
| `fact.metadata`                    | `{}` or `{ language: string }` for code blocks |
| `fact.kind`                        | Always `'fact'`                                |

### `Table`

| Method / Property                 | Description                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `table.kind`                      | Always `'table'`                                                                   |
| `table.headers`                   | Column names                                                                       |
| `table.rowCount`                  | Number of body rows                                                                |
| `table.columnCount`               | Number of columns                                                                  |
| `table.row(index)`                | Body row by 0-based index, returns `Row`                                           |
| `table.cell(col, row)`            | Fact by column and row index (row 0 = headers)                                     |
| `for (const row of table)`        | Iterate body rows                                                                  |
| `table.toMap()`                   | 2-column → `Record<string, string>`, 3+ → `Record<string, Record<string, string>>` |
| `table.toMap({ Col: codec })`     | Same but with codecs applied to named columns                                      |
| `table.toRecords()`               | Array of `Record<string, string>`                                                  |
| `table.toRecords({ Col: codec })` | Array of `Record<string, unknown>` with codecs applied                             |
| `table.eachRow(execute)`          | Run a callback for every body row (see below)                                      |
| `table.eachRow(options)`          | Same, with additional options (see below)                                          |

The first column is always the key for `toMap`. Duplicate keys throw an error.

### `table.eachRow`

Runs a callback for every body row of a table. Each column becomes a positional `Fact` argument, just like the top-level `eachRow`. Returns a `Promise`, so you must `await` it inside a `scenario` execute function.

```ts
// Simple form — just a callback
await table.eachRow((input, expected) => {
  expected.assertEquals(input.asString().toUpperCase());
});

// Options form
await table.eachRow({
  expectedColumn: 'Sum',
  codecs: {A: intCodec, B: intCodec, Sum: intCodec},
  result: intCodec,
  failFast: false,
  execute(a, b) {
    return a.asInt() + b.asInt();
  }
});
```

If `execute` returns a non-undefined value, it's compared against the expected column (the last column by default). You can also assert manually instead of returning.

When `failFast` is false (the default, falling back to the global config), all rows are processed before errors are surfaced. One failure is rethrown directly. Multiple failures produce a summary with the count and first error's details.

### `Row`

| Method / Property         | Description                     |
| ------------------------- | ------------------------------- |
| `row.value('Col')`        | String value                    |
| `row.value('Col', codec)` | Parsed value                    |
| `row.fact('Col')`         | Returns `Fact` (for assertions) |

## Data-driven tests with `eachRow`

The top-level `eachRow` is a standalone function that parses a Markdown string, finds the first table, and runs `execute` for every row. Each column becomes a positional `Fact` argument. It registers a Vitest test directly.

```ts
eachRow({
  name: 'uppercasing',
  markdown: `
Input      | Expected Output
-----------|----------------
a          | A
abc        | ABC
An example | AN EXAMPLE
`,
  execute(input) {
    return input.asString().toUpperCase();
  }
});
```

If `execute` returns a value, it's compared against the expected column (the last column by default). You can specify a different expected column, per-column codecs, and a result codec:

```ts
eachRow({
  markdown: `
A   | B   | Sum | Notes
----|-----|-----|------
1   | 2   | 3   | simple
10  | 20  | 30  | tens
`,
  expectedColumn: 'Sum',
  codecs: {A: intCodec, B: intCodec, Sum: intCodec},
  result: intCodec,
  execute(a, b) {
    return a.asInt() + b.asInt();
  }
});
```

You can also assert manually instead of returning:

```ts
execute(input, expected) {
  expected.assertEquals(input.asString().toUpperCase());
}
```

## A more involved example

When you have a setup table alongside a test-cases table, use `scenario` and call `table.eachRow` on the test-cases table.

```ts
import {LocalizedSlugs} from '@src/services/i18n/localized-slugs';
import {scenario} from '@zaunt/zest';

scenario({
  name: 'getFullLocalizedPath',
  markdown: `
Given the following localized slug data:

Locale | sign-in    | now         | yes
-------|------------|-------------|-----
en     | sign-in    | now         | yes
fr     | connexion  | maintenant  | oui
de     | anmelden   | jetzt       | ja

The full localized path for each case is:

Locale | Path                | Expected
-------|---------------------|-------------------------
en     | /                   | /
fr     | /                   | /fr/
de     | /                   | /de/
en     | /sign-in            | /sign-in
en     | /sign-in/           | /sign-in/
fr     | /sign-in            | /fr/connexion
fr     | /sign-in/           | /fr/connexion/
de     | /sign-in            | /de/anmelden
de     | /sign-in/now        | /de/anmelden/jetzt
de     | /sign-in/now/       | /de/anmelden/jetzt/
de     | /sign-in/now/yes    | /de/anmelden/jetzt/ja
en     | /sign-in/now/yes    | /sign-in/now/yes
es     | /sign-in            | [ERROR] Locale "es" not found
fr     | /missing            | [ERROR] Slug key "missing" not found for locale "fr"
de     | /sign-in/missing    | [ERROR] Slug key "missing" not found for locale "de"
`,
  async execute({tables: [setup, expectations]}) {
    const slugKeys = setup.headers.slice(1);

    const localizedSlugData: Record<string, Record<string, string>> = {};
    for (const row of setup) {
      const loc = row.value('Locale');
      localizedSlugData[loc] = {};
      for (const key of slugKeys) {
        localizedSlugData[loc][key] = row.value(key);
      }
    }

    const localizedSlugs = new LocalizedSlugs(localizedSlugData);

    await expectations.eachRow({
      execute(locale, path) {
        try {
          return localizedSlugs.getFullLocalizedPath(
            locale.asString(),
            path.asString()
          );
        } catch (e) {
          return `[ERROR] ${(e as Error).message}`;
        }
      }
    });
  }
});
```

## Configuration

```ts
import {setConfig} from '@zaunt/zest';

setConfig({
  outputEnabled: true, // write HTML reports (default: true)
  outputDir: './reports', // report output directory
  failFast: false // stop on first failure (default: false)
});
```

These can also be set via environment variables:

| Variable              | Default                                |
| --------------------- | -------------------------------------- |
| `ZEST_OUTPUT_ENABLED` | `true`                                 |
| `ZEST_OUTPUT_DIR`     | System temp directory + `/zest-output` |
| `ZEST_FAIL_FAST`      | `false`                                |

Per-scenario `failFast` overrides the global setting:

```ts
scenario({
  markdown: '...',
  failFast: true,
  execute({ facts, tables, exhibits }) { ... }
});
```

## HTML reports

After each test, Zest writes a self-contained HTML file showing the scenario with every fact colour-coded:

- 🟢 **Green** — asserted and passed
- 🔴 **Red** — asserted and failed (shows expected and actual values)
- **Neutral** — read but not asserted, or never accessed

Reports are written to the configured output directory. The filename is derived from the test name, or a hash of the Markdown if no name is given.

## Markdown format

Zest uses a proper Markdown parser ([markdown-it](https://github.com/markdown-it/markdown-it)). Tables follow GFM syntax:

```
Header1 | Header2
--------|--------
value1  | value2
```

The separator row needs at least three dashes per column. Inline facts can use any of these delimiters:

- Backticks: `` `value` ``
- Bold: `**value**`
- Italic: `*value*`
