import {createHash} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {getConfig} from '../config/zest-config';

const generateFilename = (
  name: string | undefined,
  markdown: string
): string => {
  if (name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  }
  return createHash('sha256').update(markdown).digest('hex').slice(0, 12);
};

const writeReport = (
  name: string,
  html: string,
  markdown: string
): string | undefined => {
  const config = getConfig();
  if (!config.outputEnabled) {
    return undefined;
  }

  const dir = config.outputDir;
  mkdirSync(dir, {recursive: true});

  const filename = generateFilename(name, markdown) + '.html';
  const filepath = join(dir, filename);
  writeFileSync(filepath, html, 'utf-8');
  return filepath;
};

export {writeReport, generateFilename};
