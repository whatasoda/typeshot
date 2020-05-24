import ts from 'typescript';
import { TypeToken, TokenObject } from '../typeshot';

const dummySource = ts.createSourceFile('dummy.ts', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);

export const serializeTemplate = (
  template: (string | TypeToken)[],
  intermediateTypes: Map<string, ts.TypeNode>,
  checker: ts.TypeChecker,
  printer: ts.Printer,
) => {
  return template
    .map((curr) => {
      if (typeof curr === 'string') {
        return curr;
      } else if (curr instanceof TokenObject) {
        const typeNode = intermediateTypes.get(curr.id);
        if (!typeNode) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to serialize ${curr.name}. No intermediate type found.`);
          return '';
        }
        return serializeEntry(typeNode, curr, checker, printer);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`Unhandled template element detected: ${curr}`);
        return '';
      }
    })
    .join('');
};

export const serializeEntry = (
  typeNode: ts.TypeNode,
  token: TypeToken,
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
  if (resolved) {
    const literal = printer.printNode(ts.EmitHint.Unspecified, resolved, dummySource);
    if (token.format === 'literal') return literal;

    if (token.format === 'alias') return `type ${token.name} = ${literal};`;

    if (token.format === 'interface') {
      if (ts.isTypeLiteralNode(resolved)) return `interface ${token.name} ${literal}`;
      if (ts.isTypeReferenceNode(resolved)) return `interface ${token.name} extends ${literal} {}`;
      // eslint-disable-next-line no-console
      console.warn(
        `Failed to serialize '${token.name}' into interface declaration. Cannot convert '${literal}' into interface.`,
      );
      return `interface ${token.name} {}`;
    }
  }

  // eslint-disable-next-line no-console
  console.warn(`Failed to serialize '${token.name}'. Something wrong happend.`);
  return '';
};
