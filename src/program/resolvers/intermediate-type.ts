import ts from 'typescript';
import type { TypeshotEntry } from '../decls';
import type { AddReplecement } from '../transform';

const INTERMEDIATE_TYPE_NAME = '__TYPESHOT_INTERMEDIATE__';
export const createIntermediateType = (entries: TypeshotEntry[]) => {
  return ts.createInterfaceDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    INTERMEDIATE_TYPE_NAME,
    undefined,
    undefined,
    entries.map(({ key, type }) => {
      return ts.createPropertySignature(undefined, ts.createStringLiteral(key), undefined, type, undefined);
    }),
  );
};

export const parseIntermediateType = (statement: ts.Statement, replace: AddReplecement) => {
  const types = new Map<string, ts.TypeNode>();
  if (ts.isInterfaceDeclaration(statement) && statement.name.text === INTERMEDIATE_TYPE_NAME) {
    replace(statement.pos, statement.end, '');
    statement.members.forEach((member) => {
      if (ts.isPropertySignature(member) && ts.isStringLiteral(member.name) && member.type) {
        types.set(member.name.text, member.type);
      }
    });
  }

  return types;
};
