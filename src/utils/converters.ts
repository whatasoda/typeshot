import { relative } from 'path';

export const getSymbolName = (symbol: symbol): string => symbol.toString().slice(/* Symbol( */ 7, /* ) */ -1);

export const getDirectoryLessPath = (p: string, basePath: string) => {
  return relative(basePath, p)
    .replace(/^(\.\/)?/, '_/')
    .replace(/-/g, '--')
    .replace(/((?<!\/\.)\.(?!\.\/)|(?<=\/\.)\.(?!\/)|(?<!\/)\.(?=\.\/))(?!tsx?$)/g, '-') // replace dot except included in '/../', '.ts', '.tsx'
    .replace(/\//g, '.');
};
