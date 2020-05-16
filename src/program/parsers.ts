import ts from 'typescript';
import { flattenCallLikeExpressionChain } from './ast-utils';
import type { TypeInformation } from './decls';

type OneOfSection = typeof SECTIONS[number];

const SECTIONS = ['output-header', 'header', 'main', 'footer', 'output-footer'] as const;
const SECTION_COUNT = SECTIONS.length;
const COMMENT_PATTERNS = SECTIONS.map((key) => new RegExp(`(^|\\s)typeshot-${key}(\\s|$)`));

export const COMMENT_NODES = SECTIONS.reduce<Record<string, ts.EmptyStatement>>((acc, key) => {
  acc[key] = ts.addSyntheticLeadingComment(
    ts.createEmptyStatement(),
    ts.SyntaxKind.SingleLineCommentTrivia,
    ` typeshot-${key}`,
    false,
  );
  return acc;
}, {}) as Record<OneOfSection, ts.EmptyStatement>;

export const splitStatements = (source: ts.SourceFile) => {
  const fullText = source.getFullText();
  const { statements } = source;

  let patterns = [...COMMENT_PATTERNS];
  const sectionStartIndices = Array.from<number | null>({ length: SECTION_COUNT }).fill(null);
  statements.forEach(({ pos }, index) => {
    // accepts only leading comments
    ts.getLeadingCommentRanges(fullText, pos)?.forEach(({ kind, pos, end }) => {
      if (!(kind & ts.SyntaxKind.SingleLineCommentTrivia)) return;
      const comment = fullText.slice(pos + 2, end);
      const curr = patterns.findIndex((pattern) => pattern.test(comment));
      if (curr === -1) return;
      sectionStartIndices[curr] = index;
      patterns = patterns.slice(curr + 1);
    });
  });

  // fill index of unused section
  const nonnullableStatIndices = SECTIONS.map((_, i) => {
    while (i < SECTION_COUNT) {
      const start = sectionStartIndices[i++];
      if (typeof start === 'number') return start;
    }
    return statements.length;
  });

  return nonnullableStatIndices.reduce<Record<string, ts.Statement[]>>((acc, start, i, { [i + 1]: end }) => {
    acc[SECTIONS[i]] = statements.slice(start, end);
    return acc;
  }, {}) as Record<OneOfSection, ts.Statement[]>;
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
