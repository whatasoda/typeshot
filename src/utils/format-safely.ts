import { format, Options, resolveConfig } from 'prettier';

const defaultPrettierOptions: Options = {
  parser: 'typescript',
};
export const formatSafely = (rawContent: string, basePath: string, options: Options | string | undefined) => {
  try {
    options =
      (typeof options === 'string'
        ? resolveConfig.sync(basePath, { config: options })
        : options || resolveConfig.sync(basePath)) || defaultPrettierOptions;
    return format(rawContent, options);
  } catch (e) {
    console.log(e);
    return rawContent;
  }
};
