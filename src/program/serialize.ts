import ts from 'typescript';
import type { TypeshotEntry } from './decls';
import { TemplateSymbols } from '../typeshot';

const dummySource = ts.createSourceFile('dummy.ts', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);

export const serializeEntry = (
  { type: typeNode, template, substitutions, name }: TypeshotEntry,
  checker: ts.TypeChecker,
  printer: ts.Printer,
) => {
  const type = checker.getTypeFromTypeNode(typeNode);
  const resolved = checker.typeToTypeNode(
    type,
    undefined,
    ts.NodeBuilderFlags.InTypeAlias |
      ts.NodeBuilderFlags.NoTruncation |
      ts.NodeBuilderFlags.IgnoreErrors |
      ts.NodeBuilderFlags.MultilineObjectLiterals |
      ts.NodeBuilderFlags.GenerateNamesForShadowedTypeParams,
  );
  if (!resolved) return '';

  const content = printer.printNode(ts.EmitHint.Unspecified, resolved, dummySource);
  const declaration = `type ${name} = ${content};`;
  return String.raw(
    (Object.assign([...template], { raw: template }) as unknown) as TemplateStringsArray,
    ...substitutions.map((symbol) => {
      switch (symbol) {
        case TemplateSymbols.NAME:
          return name;
        case TemplateSymbols.CONTENT:
          return content;
        case TemplateSymbols.DECLARATION:
          return declaration;
        default:
          return '';
      }
    }),
  );
};
