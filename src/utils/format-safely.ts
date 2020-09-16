import { format, Options, resolveConfig } from 'prettier';

const defaultPrettierOptions: Options = {
  parser: 'typescript',
};
export const formatSafely = (rawContent: string, basePath: string, options: Options | undefined) => {
  try {
    options = options || resolveConfig.sync(basePath) || defaultPrettierOptions;
    return format(rawContent, options);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
    return rawContent;
  }
};
