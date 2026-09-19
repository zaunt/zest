type ZestConfig = {
  outputEnabled: boolean;
  outputDir: string;
  failFast: boolean;
};

const defaultOutputDir = (): string => {
  const tmpDir =
    typeof process !== 'undefined' ?
      (process.env['TMPDIR'] ?? process.env['TEMP'] ?? '/tmp')
    : '/tmp';
  return `${tmpDir}/zest-output`;
};

const readEnvBoolean = (name: string, fallback: boolean): boolean => {
  if (typeof process === 'undefined') {
    return fallback;
  }
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() !== 'false' && value !== '0';
};

const readEnvString = (name: string, fallback: string): string => {
  if (typeof process === 'undefined') {
    return fallback;
  }
  return process.env[name] ?? fallback;
};

const loadConfig = (overrides?: Partial<ZestConfig>): ZestConfig => ({
  outputEnabled:
    overrides?.outputEnabled ?? readEnvBoolean('ZEST_OUTPUT_ENABLED', true),
  outputDir:
    overrides?.outputDir ??
    readEnvString('ZEST_OUTPUT_DIR', defaultOutputDir()),
  failFast: overrides?.failFast ?? readEnvBoolean('ZEST_FAIL_FAST', false),
  ...overrides
});

let globalConfig: ZestConfig = loadConfig();

const getConfig = (): ZestConfig => globalConfig;

const setConfig = (overrides: Partial<ZestConfig>): void => {
  globalConfig = loadConfig(overrides);
};

export {loadConfig, getConfig, setConfig};
export type {ZestConfig};
