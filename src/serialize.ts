import ts from 'typescript';
import { TemplateSymbols } from './symbols';

const dummySource = ts.createSourceFile('dummy.ts', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);

export const serializeEntry = (
  { type: typeNode, template, substitutions, name }: typeshot.DefaultEntry,
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
      ts.NodeBuilderFlags.UseFullyQualifiedType |
      ts.NodeBuilderFlags.MultilineObjectLiterals |
      ts.NodeBuilderFlags.GenerateNamesForShadowedTypeParams,
  );
  if (!resolved) return '';

  const content = printer.printNode(ts.EmitHint.Unspecified, resolved, dummySource);
  const declaration = `type ${name} = ${content};`;
  return String.raw(
    ({ raw: template } as unknown) as TemplateStringsArray,
    substitutions.map((symbol) => {
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
