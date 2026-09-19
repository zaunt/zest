import {createScenarioApi} from '../scenario-api';
import {createVitestAdapter} from './vitest-adapter';

const {scenario, eachRow} = createScenarioApi(createVitestAdapter());

export {scenario, eachRow};
export {Fact} from '../../core/fact';
export {FactList} from '../../core/fact-list';
export {Context} from '../../core/context';
export {Table} from '../../core/table';
export {Row} from '../../core/row';
export type {Exhibit} from '../../core/exhibit';
export type {ExecuteArgs} from '../scenario-definitions';
export {
  stringCodec,
  intCodec,
  floatCodec,
  booleanCodec,
  enumCodec,
  mappedCodec
} from '../../core/codecs';
export {setConfig} from '../../config/zest-config';
export type {ZestConfig} from '../../config/zest-config';
