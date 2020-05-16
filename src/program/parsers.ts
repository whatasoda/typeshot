import ts from 'typescript';
import { flattenCallLikeExpressionChain } from './ast-utils';
import type { TypeInformation } from './decls';

const SECTIONS = ['OUTPUT_HEADER', 'HEADER', 'MAIN', 'FOOTER', 'OUTPUT_FOOTER'] as const;
type OneOfSection = typeof SECTIONS[number];

const SECTION_COMMENTS: Record<OneOfSection, string> = {
  OUTPUT_HEADER: 'typeshot-output-header',
  HEADER: 'typeshot-header',
  MAIN: 'typeshot-main',
  FOOTER: 'typeshot-footer',
  OUTPUT_FOOTER: 'typeshot-output-footer',
};

const COMMENT_PATTERNS = SECTIONS.reduce<Record<OneOfSection, RegExp>>((acc, key) => {
  acc[key] = new RegExp(`(^|\\s)${SECTION_COMMENTS[key]}(\\s|$)`);
  return acc;
}, {} as any);

export const COMMENT_NODES = SECTIONS.reduce<Record<OneOfSection, ts.EmptyStatement>>((acc, key) => {
  acc[key] = ts.addSyntheticLeadingComment(
    ts.createEmptyStatement(),
    ts.SyntaxKind.SingleLineCommentTrivia,
    ` ${SECTION_COMMENTS[key]}`,
    false,
  );
  return acc;
}, {} as any);

export const splitStatements = (source: ts.SourceFile) => {
  const fileFullText = source.getFullText();

  let pointer = -1;
  const sections: Record<OneOfSection, ts.Statement[]> = {} as any;
  const splitters: (number | undefined)[] = [];

  source.statements.forEach(({ pos }, splitter) => {
    // accepts only leading comments
    const leadingRange = ts.getLeadingCommentRanges(fileFullText, pos);
    leadingRange?.forEach((range) => {
      if (!(range.kind & ts.SyntaxKind.SingleLineCommentTrivia)) return;
      const comment = fileFullText.slice(range.pos + 2, range.end);
      const start = pointer + 1;
      const next = start + SECTIONS.slice(start).findIndex((key) => COMMENT_PATTERNS[key].test(comment));
      if (next === pointer) return;
      splitters[next] = splitter;
      pointer = next;
    });
  });

  SECTIONS.map((_, i) => {
    while (i < SECTIONS.length) {
      const curr = splitters[i++];
      if (typeof curr === 'number') return curr;
    }
    return source.statements.length;
  }).forEach((index, i, arr) => (sections[SECTIONS[i]] = source.statements.slice(index, arr[i + 1])));

  return sections;
};

export const parsePreTypeEntries = (statements: ReadonlyArray<ts.Statement>) => {
  const entries: TypeInformation[] = [];
  statements.forEach((stmt) => {
    if (ts.isExpressionStatement(stmt)) {
      const entry = parseTypeshotExpression(stmt.expression);
      if (!entry) return;
      entries.push(entry);
      if (entry.key.startsWith('dynamic')) {
        // TODO: warning since we expect 'default' mode entry here
      }
    }

    if (ts.isVariableStatement(stmt)) {
      // avoid 'var' variable
      if (!(stmt.declarationList.flags & ts.NodeFlags.BlockScoped)) {
        // TODO: error log
        return;
      }
      stmt.declarationList.declarations.forEach((decl) => {
        if (!decl.initializer) return;

        const entry = parseTypeshotExpression(decl.initializer);
        if (!entry) return;
        entries.push(entry);
        if (entry.key.startsWith('static')) {
          // TODO: warning since we expect 'dynamic' mode entry here
        }
      });
    }
  });

  if (!entries.length) return null;

  return entries.reduce<Record<string, TypeInformation>>((acc, entry) => {
    if (entry.key in acc) {
      // eslint-disable-next-line no-console
      console.warn(`Duplicated key found! Skipped '${entry.key}'.`);
    } else {
      acc[entry.key] = entry;
    }
    return acc;
  }, Object.create(null));
};

const keyMap = {
  static: 'typeshot.takeStatic',
  dynamic: 'typeshot.createDynamic',
};
const writerPhaseIndexMap = {
  'typeshot.takeStatic': 1,
  'typeshot.createDynamic': 3,
};
const keyList = Object.values(keyMap);

export const parseTypeshotExpression = (entry: ts.Expression): TypeInformation | null => {
  const phases = flattenCallLikeExpressionChain(entry);
  const topPhase = phases[0];
  if (!(topPhase && ts.isCallExpression(topPhase))) return null;
  const type = topPhase.typeArguments?.[0];
  const text = topPhase.expression.getText().replace(/\s/g, '');
  const keyNode = topPhase.arguments[0];

  if (!(ts.isStringLiteral(keyNode) && type && keyList.includes(text))) {
    return null;
  }

  const key = keyNode.text;
  const writePhase = phases[writerPhaseIndexMap[text as keyof typeof writerPhaseIndexMap]];
  if (!ts.isTaggedTemplateExpression(writePhase) || writePhase !== entry /* should have no appendix */) return null;

  if (text === keyMap.static) return { type, key: `static:${key}` };

  if (text === keyMap.dynamic) {
    const phaseMatched = ['parameters', 'names'].every((text, i) => {
      const phase = phases[i + 1];
      return (
        ts.isCallExpression(phase) &&
        ts.isPropertyAccessExpression(phase.expression) &&
        phase.expression.name.text === text
      );
    });
    if (!phaseMatched) return null;

    return { type, key: `dynamic:${key}` };
  }

  return null;
};

export const parseDefaultTypeshotExpression = (statement: ts.Statement) => {
  if (
    !(
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      statement.expression.expression.getText() === 'typeshot' &&
      statement.expression.arguments.length === 1 &&
      statement.expression.typeArguments?.length === 1
    )
  ) return null; // eslint-disable-line prettier/prettier

  const [keyNode] = statement.expression.arguments;
  const [type] = statement.expression.typeArguments;
  if (!ts.isStringLiteral(keyNode)) return null;

  return { key: keyNode.text, type };
};
