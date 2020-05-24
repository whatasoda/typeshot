import ts from 'typescript';
import type { AddReplecement } from '../transform';
import { TypeRequest } from '../../context';

const INTERMEDIATE_TYPE_NAME = '__TYPESHOT_INTERMEDIATE__';
export const createIntermediateType = (requests: TypeRequest[]) => {
  return ts.createInterfaceDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    INTERMEDIATE_TYPE_NAME,
    undefined,
    undefined,
    requests.map(({ id, type, property }) => {
      return ts.createPropertySignature(
        undefined,
        ts.createStringLiteral(id),
        undefined,
        applyPropertyAccess(type, property),
        undefined,
      );
    }),
  );
};

export const applyPropertyAccess = (type: ts.TypeNode, property: number | string | undefined) => {
  if (typeof property === 'number') {
    return ts.createIndexedAccessTypeNode(type, ts.createLiteralTypeNode(ts.createNumericLiteral(property.toString())));
  }
  if (typeof property === 'string') {
    return ts.createIndexedAccessTypeNode(type, ts.createLiteralTypeNode(ts.createStringLiteral(property)));
  }
  return type;
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
