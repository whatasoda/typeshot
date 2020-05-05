import ts from 'typescript';
import { flattenCallLikeExpressionChain } from './ast-utils';

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

  splitters
    .map((_, i) => {
      while (i < SECTIONS.length) {
        const curr = splitters[i++];
        if (typeof curr === 'number') return curr;
      }
      return source.statements.length - 1;
    })
    .forEach((index, i, arr) => (sections[SECTIONS[i]] = source.statements.slice(index, arr[i + 1])));

  return sections;
};

export const parseTypeEntriesFromStatements = (statements: ReadonlyArray<ts.Statement>) => {
  const entries: typeshot.TypeEntry[] = [];
  statements.forEach((stmt) => {
    if (ts.isExpressionStatement(stmt)) {
      const entry = parseTypeshotExpression(stmt.expression);
      if (!entry) return;
      entries.push(entry);
      if (entry.mode === 'dynamic') {
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
        if (entry.mode === 'default') {
          // TODO: warning since we expect 'dynamic' mode entry here
        }
      });
    }
  });

  if (!entries.length) return null;

  return entries.reduce<typeshot.TypeEntryContainer>(
    (acc, entry) => {
      if (entry.key in acc[entry.mode]) {
        // eslint-disable-next-line no-console
        console.warn(`Duplicated key for ${entry.mode} mode found! Skipped '${entry.key}'.`);
      } else {
        acc[entry.mode][entry.key] = entry;
      }
      return acc;
    },
    { default: Object.create(null), dynamic: Object.create(null) },
  );
};

export const parseTypeshotExpression = (entry: ts.Expression): typeshot.TypeEntry | null => {
  const phases = flattenCallLikeExpressionChain(entry);
  const topPhase = phases[0];
  if (!(topPhase && ts.isCallExpression(topPhase))) return null;
  const type = topPhase.typeArguments?.[0];
  const text = topPhase.expression.getText().replace(/\s/g, '');
  const keyNode = topPhase.arguments[0];

  if (!(ts.isStringLiteral(keyNode) && type && (text === 'typeshot' || text === 'typeshot.dynamic'))) return null;

  const key = keyNode.text;
  const writePhase = phases[text === 'typeshot' ? 1 : 2];
  if (!ts.isTaggedTemplateExpression(writePhase) || writePhase !== entry /* should have no appendix */) return null;

  if (text === 'typeshot') return { mode: 'default', type, key: `default:${key}` };

  if (text === 'typeshot.dynamic') {
    const parameterPhase = phases[1];
    if (
      !(
        ts.isCallExpression(parameterPhase) &&
        ts.isPropertyAccessExpression(parameterPhase.expression) &&
        parameterPhase.expression.name.text === 'parameters'
      )
    ) return null; // eslint-disable-line prettier/prettier

    return { mode: 'dynamic', type, key: `dynamic:${key}` };
  }

  return null;
};
