## Zest Scenario Testing — Quick Reference

### Imports

```ts
import {
  scenario,
  eachRow,
  Context,
  FactList,
  stringCodec,
  intCodec,
  floatCodec,
  booleanCodec,
  enumCodec,
  mappedCodec
} from '@zaunt/zest';
```

### Codecs

A codec parses a string to a typed value and formats it back.

- `stringCodec` — identity.
- `intCodec` — `parseInt`/`String()`.
- `floatCodec(fractionDigits?)` — `parseFloat`; formats with `toFixed` if `fractionDigits` given.
- `booleanCodec(truthy?, falsy?, ignoreCase?)` — defaults `'yes'`/`'no'`, case-insensitive.
- `enumCodec(values, ignoreCase?)` — matches against string literal union.
- `mappedCodec(parseMap, formatMap, ignoreCase?)` — arbitrary string↔value mapping.

### Exhibits, facts and tables

Zest extracts **exhibits** from markdown in document order. An exhibit is a `Fact` or a `Table`.

**Facts** (`kind: 'fact'`) come from backtick-wrapped text, bold (`**v**`), italic (`*v*`), fenced code blocks, or indented code blocks. All produce a single string value. Leading/trailing blank lines are trimmed; internal whitespace is preserved. Code block facts have `metadata: { language: 'ts' }` (fenced with language tag) or `metadata: {}`; non-code-block facts always have `metadata: {}`.

**Tables** (`kind: 'table'`) come from GFM markdown tables. Backticks, bold and italic inside cells don't produce separate facts.

Nested facts (e.g. ``**`value`**``) and lists (bulleted/numbered) throw errors. Do not use them.

### `scenario`

```ts
scenario({
  name?: string,
  markdown: string,
  result?: codec,        // default stringCodec; only used if execute returns non-undefined
  failFast?: boolean,
  execute(context) { ... }
});
```

The `execute` function receives a `Context` with:

- `facts: FactList`, `tables: Table[]`, `exhibits: Exhibit[]` — views over the same underlying objects.
- `sectionNames: string[]` — direct child section names.
- `allSectionNames: { name: string; level: number }[]` — all descendant headings.
- `section(name)` / `section(/regex/)` — returns a sub-context scoped to that section. Throws if zero or multiple headings match.

If `execute` returns a non-undefined value, it's compared to the **last fact** using the `result` codec. Otherwise assert manually with `fact.assertEquals(actual)` or `fact.assertEquals(actual, codec)`.

```ts
// Return-value assertion (last fact is expected output)
scenario({
  markdown: 'When made uppercase `fred` becomes `FRED`.',
  execute({facts: [input]}) {
    return input.asString().toUpperCase();
  }
});

// Manual assertion
scenario({
  name: 'Boolean negation',
  markdown: 'The input is `aye` the output is `nay`.',
  execute({facts: [input, output]}) {
    const codec = booleanCodec('aye', 'nay');
    output.assertEquals(!input.as(codec), codec);
  }
});
```

### Sections

Headings divide the document into sections. A section spans from a heading to the next heading at the same or higher level, or to the end. Level 1 headings (`#`) are ignored for section purposes (treated as document title).

`context.section(name)` returns a sub-context with its own `facts`, `tables`, `exhibits`, `sectionNames`, `allSectionNames`, and `section()` — all filtered to that section's content (including subsections, flattened).

`sectionNames` returns direct child section names. If `###` headings appear before any `##`, they're treated as direct children until a shallower heading appears.

Sections nest: `context.section('Parent').section('Child')`. You can iterate:

```ts
for (const name of context.sectionNames) {
  const {
    facts: [input, expected]
  } = context.section(name);
  expected.assertEquals(transform(input.asString()));
}
```

### Prose blocks

Top-level markdown lists throw errors because they are reserved for future features. To include lists or explanatory notes without creating facts, wrap narrative text in a `<prose>` tag.

Zest treats everything inside a prose block as plain text: lists are permitted, and backticks, bold, italic, or code blocks do not create facts.

```markdown
# calculateDiscount()

<prose>

Discounts apply under these conditions:

- Orders over `100` receive **10%** off
- Premium members always receive **15%** off

</prose>

Spend `150` gets discount `15`.
```

In this example, only `150` and `15` are extracted as facts.
Note the blank lines before and after the `<prose>` tags.
These are needed for the CommonMark parser to process the inside as Markdown.

### FactList API

`FactList` is iterable and destructurable: `const [a, b, c] = facts`.

- `facts.length`, `facts.at(index)` — 0-based, throws if out of range.
- `facts.byLanguage(language, n)` — *n*th (0-based) code block with given language tag. Throws if not found.

### Fact API

- `fact.asString()` — raw string value.
- `fact.asInt()` — parse as integer.
- `fact.as(codec)` — parse with codec.
- `fact.assertEquals(actual)` — asserts with `stringCodec`.
- `fact.assertEquals(actual, codec)` — asserts with given codec.
- `fact.metadata`, `fact.kind` (`'fact'`).

Each fact can only be asserted once.

### Table API

- `table.kind` (`'table'`), `table.headers`, `table.rowCount`, `table.columnCount`.
- `table.row(index)` — 0-based body row, returns `Row`.
- `table.cell(col, row)` — returns `Fact`. Row 0 is header row.
- Iterable over body rows.
- `table.toMap(codecs?)` — 2-column → `Record<string, T>`. 3+ columns → `Record<string, Record<string, T>>`. First column is key. Duplicate keys throw.
- `table.toRecords(codecs?)` — `Record<string, T>[]`.
- `table.eachRow(execute)` or `table.eachRow(options)` — see below.

### Row API

- `row.value('Col')` / `row.value('Col', codec)` — string or parsed value.
- `row.fact('Col')` — returns `Fact` for assertions.

### `table.eachRow`

```ts
table.eachRow(execute);
table.eachRow({
  expectedColumn?: string,     // defaults to last column
  codecs?: { Col: codec },
  result?: codec,              // default stringCodec
  failFast?: boolean,
  execute(...facts) { ... }
});
```

If `execute` returns non-undefined, it's compared to the expected column. Returns a `Promise` — must `await` inside scenario. When `failFast` is false, all rows are processed; one failure rethrows directly, multiple produce a summary.

### `eachRow` (top-level)

Standalone function: parses markdown, finds first table, runs callback per row. Registers a Vitest test.

```ts
eachRow({
  name?: string,
  markdown: string,
  expectedColumn?: string,     // defaults to last column
  codecs?: { Col: codec },
  result?: codec,              // default stringCodec
  failFast?: boolean,
  execute(...facts) { ... }
});
```

### Example: scenario with table and inline facts

```ts
import {redirectToTrailingSlash} from '@src/website/common/http/redirects';
import {scenario} from '@zaunt/zest';
import {Hono} from 'hono';

scenario({
  name: 'redirectToTrailingSlash',
  markdown: `
# redirectToTrailingSlash()

Registers a '301 Moved Permanently' redirect from a path to the same path with a trailing slash.

Path          | Request Path      | Expected Location
--------------|-------------------|-------------------
/foo          | /foo              | /foo/
/bar/baz      | /bar/baz          | /bar/baz/
/a            | /a                | /a/

Throws an exception if the specified path already ends with a slash.

For example, if you try to register the path \`/foo/\`,
it throws an error with message:
<br/>\`Path "/foo/" already ends with a slash\`
`,
  async execute({facts: [invalidPath, expectedError], tables: [redirects]}) {
    await redirects.eachRow({
      async execute(path, requestPath) {
        const app = new Hono();
        redirectToTrailingSlash(app, path.asString());
        const res = await app.request(requestPath.asString(), {
          redirect: 'manual'
        });
        return res.headers.get('Location')!;
      }
    });

    try {
      const app = new Hono();
      redirectToTrailingSlash(app, invalidPath.asString());
      expectedError.assertEquals('[no error thrown]');
    } catch (e) {
      expectedError.assertEquals((e as Error).message);
    }
  }
});
```

Note how the required behavior is briefly explained before the test cases. This is important because otherwise the reader must guess the rule from examples alone.

### Example: eachRow with codec

```ts
import {getFormBoolean} from '@src/website/common/http/form-util';
import {eachRow, booleanCodec} from '@zaunt/zest';

eachRow({
  name: 'getFormBoolean',
  markdown: `
# getFormBoolean()

Returns \`true\` when the form field value is \`on\`, \`true\`, or \`1\`.
Returns \`false\` for any other value, including when the key is absent.

Value     | Expected
----------|----------
on        | yes
true      | yes
1         | yes
off       | no
false     | no
0         | no
whatever  | no
(absent)  | no
`,
  result: booleanCodec(),
  execute(value) {
    const formData = new FormData();
    const raw = value.asString();
    if (raw !== '(absent)') {
      formData.set('field', raw);
    }
    return getFormBoolean(formData, 'field');
  }
});
```

### Example: sections

```ts
scenario({
  name: 'createProdViteAssetTagsService',
  markdown: `# createProdViteAssetTagsService()

Generates asset tags from a Vite manifest. It collects the entry's JS file,
any CSS dependencies, and transitively imported chunks — emitting
\`<link rel="stylesheet">\` for CSS, \`<link rel="modulepreload">\` for
imported chunks, and a \`<script type="module">\` for the entry itself.

Given this manifest:

\`\`\`json
{
  "_shared-abc123.js": {
    "file": "js/shared-abc123.js",
    "css": ["css/shared-xyz.css"]
  },
  "src/app.ts": {
    "file": "js/app-def456.js",
    "imports": ["_shared-abc123.js"],
    "css": ["css/app-uvw.css"]
  },
  "src/other.ts": {
    "file": "js/other-ghi789.js"
  }
}
\`\`\`

## Entry with imports and CSS

Requesting entry \`src/app.ts\` produces tags that include:
a stylesheet link for the entry's own CSS;
a stylesheet link for the shared chunk's CSS;
a modulepreload for the shared chunk;
the entry script

\`\`\`html
<link rel="stylesheet" href="/css/app-uvw.css" />
<link rel="stylesheet" href="/css/shared-xyz.css" />
<link rel="modulepreload" href="/js/shared-abc123.js" />
<script type="module" src="/js/app-def456.js"></script>
\`\`\`

## Entry with no imports

Requesting entry \`src/other.ts\` produces just the entry script tag.

\`\`\`html
<script type="module" src="/js/other-ghi789.js"></script>
\`\`\`

## Unknown entry

Requesting an entry that doesn't exist in the manifest (e.g. \`src/nonexistent.ts\`) produces empty output.

\`\`\`html
\`\`\`

## Custom base path

Using a custom base path \`/static/\` for entry \`src/other.ts\` produces:

\`\`\`html
<script type="module" src="/static/js/other-ghi789.js"></script>
\`\`\``,
  async execute(context) {
    const manifest = JSON.parse(
      context.facts.byLanguage('json', 0).asString()
    ) as ViteManifest;
    const defaultService = createProdViteAssetTagsService(manifest);
    const normalize = (s: string) =>
      s
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n');

    for (const sectionName of [
      'Entry with imports and CSS',
      'Entry with no imports',
      'Unknown entry'
    ]) {
      const {
        facts: [input, expected]
      } = context.section(sectionName);
      expected.assertEquals(normalize(await defaultService(input.asString())));
    }

    const {
      facts: [basePath, entry, expected]
    } = context.section('Custom base path');
    const customService = createProdViteAssetTagsService(
      manifest,
      basePath.asString()
    );
    expected.assertEquals(normalize(await customService(entry.asString())));
  }
});
```

Note that all relevant facts are drawn from facts in the spec.
Nothing relevant to the behavior being tested is hardcoded in the execute method.
But things that are irrelevant to the behavior being tested aren't included in the scenario and may be hardcoded in the execute method.

### Hints for writing Zest tests

The point of Zest tests is to protect you when you refactor.
They protect you by explaining the functionality in a way that doesn't change when you refactor.
In other words, they explain the external behaviour rather than the implementation.
That lets you change the implementation and get the protection, because you can check that the behaviour still works as before.
Without this kind of stability and separation, you'd end up having to change the tests and code at the same time, which would be a recipe for errors.

The fixture code acts as a kind of go-between for the scenarios and the system under test.
Its purpose is to shield the scenarios from the details of the system under test.

The upshot is that the scenarios need to be written in a careful way to avoid introducing unnecessary implementation details that lock you into a specific implementation.

For example, rather than scripting and saying, 'Do this, then do that. Click here, click that,' the scenarios should just explain the desired state and let the fixture figure out how to get the system under test into that state.

A second advantage of this approach is that the same scenarios can be run against different levels of the implementation.
For example, they could be run against a particular unit, or they could be run against the system as a whole.
The scenarios are effectively scale-free.

Another important consideration when writing scenarios is to avoid including information that isn't necessary to describe the particular behaviour being demonstrated.
For example, if you are testing that passwords match a certain set of rules, then you don't need to include details of the user or the login page or anything like that.
You can just focus on explaining the rules of the password, to let the fixture decide how to set the system into the right state to expose that functionality to the test.

Often you will want to test each rule separately, but sometimes, as in password rules, you need to test all of the rules combined because they are all checked at once.
You can't just test the password length rule on its own with a bunch of different-length passwords that have no numbers, if the rules say that you also need numbers.
So you have to think quite carefully about exactly what you're testing and what needs to be included and what shouldn't be included, to make the test as simple as possible but no simpler.

One of the common failure modes is to include unnecessary information instead of letting the fixture code decide any details that are unimportant to the behaviour being explained.

Another failure mode is to give only the scenarios without explaining the rules behind them.
That forces the reader to have to infer (fallibly guess) the rules which is totally unnecessary if you just explain the rules.

Explaining the rules also helps you to figure out exactly what scenarios you need to test.
Sometimes scenario writers over-specify and test things that aren't necessary.
