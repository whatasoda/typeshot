import path from 'path';

export const getSymbolName = (symbol: symbol): string => symbol.toString().slice(/* Symbol( */ 7, /* ) */ -1);

export const getDirectoryLessPath = (p: string, basePath: string) => {
  return path
    .relative(basePath, p)
    .replace(/^(\.\/)?/, '_/')
    .replace(/-/g, '--')
    .replace(/((?<!\/\.)\.(?!\.\/)|(?<=\/\.)\.(?!\/)|(?<!\/)\.(?=\.\/))(?!tsx?$)/g, '-') // replace dot except included in '/../', '.ts', '.tsx'
    .replace(/\//g, '.');
};

export const ensureAbsolutePath = (p: string, basePath: string, maybeLibrary: boolean = false) => {
  if (p.startsWith(path.sep)) {
    return p;
  } else if (!maybeLibrary || /^\.+\//.test(p)) {
    return path.resolve(basePath, p);
  } else {
    return p;
  }
};
