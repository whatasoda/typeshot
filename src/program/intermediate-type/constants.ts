import ts from 'typescript';

export const dummyFile = ts.createSourceFile('__dummy__.ts', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
export const defaultBuilderFlags =
  ts.NodeBuilderFlags.InTypeAlias |
  ts.NodeBuilderFlags.NoTruncation |
  ts.NodeBuilderFlags.IgnoreErrors |
  ts.NodeBuilderFlags.GenerateNamesForShadowedTypeParams |
  ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope |
  0;

export const INTEGRATE = 'typeshot.Integrate';
export const EVAL = '/* typeshot.Eval */';
export const patternEVAL = /^\/\* typeshot\.Eval \*\//;
