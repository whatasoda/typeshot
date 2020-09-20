import typeshot from 'typeshot';
import path from 'path';

typeshot.openTrace`
// DO NOT EDIT MANUALLY - GENERATED FILE
`;
export interface FileType {
  '.ts': object;
  '.tsx': string;
  '.png': Buffer;
  '.jpg': string;
}
typeshot.closeTrace();

const createFileInformationMap = typeshot.registerTypeDefinition((createTypeFragment, paths: string[]) => {
  const acc = Object.create(null);
  paths.forEach((p) => {
    const extname = path.extname(p) as keyof FileType;
    const fragment = createTypeFragment<{ [K in typeof p]: FileType[typeof extname] }>({ p, extname });
    Object.assign(acc, fragment);
  });
  return acc;
});

const paths: string[] = ['./foo/bar.ts', './baz/qux.png', './qux/baz.tsx', './bar/foo.jpg'];

typeshot.print`
export ${createFileInformationMap(paths).interface('FileInformationMap')}
`;
