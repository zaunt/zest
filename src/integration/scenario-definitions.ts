import type {Codec} from '../core/codec';
import type {Context} from '../core/context';
import type {Fact} from '../core/fact';

type ExecuteArgs = Context;

type ScenarioDefinition = {
  name?: string;
  markdown: string;
  result?: Codec<unknown>;
  failFast?: boolean;
  debug?: boolean;
  execute: (args: ExecuteArgs) => unknown;
};

type EachRowDefinition = {
  name?: string;
  markdown: string;
  codecs?: Record<string, Codec<unknown>>;
  expectedColumn?: string;
  result?: Codec<unknown>;
  failFast?: boolean;
  execute: (...facts: Fact[]) => unknown;
};

export type {ExecuteArgs, ScenarioDefinition, EachRowDefinition};
