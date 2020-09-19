import ts from 'typescript';
import { SourceTrace } from '../typeshot/source-trace';
import { getNodeByStack } from '../utils/ast';

export type TraceTransformHoleyArray = TraceTransform[] & { [index: number]: TraceTransform | undefined };
export interface TraceTransform {
  start: number;
  end: number;
  content: string;
}

export const resolveSourceTrace = (sourceFile: ts.SourceFile, sourceTrace: SourceTrace) => {
  const { leadingTrace, tailingTrace } = sourceTrace;
  const [leadingNode] = getNodeByStack(leadingTrace.stack, sourceFile).nodePath;
  const [tailingNode] = getNodeByStack(tailingTrace.stack, sourceFile).nodePath;
  sourceTrace.start = leadingNode.getEnd();
  sourceTrace.end = tailingNode.getStart();
};

export const serializeSourceTrace = (
  sourceText: string,
  sourceTrace: SourceTrace,
  transforms: TraceTransformHoleyArray,
) => {
  const { start, end, leadingTrace, tailingTrace } = sourceTrace;
  let acc = '';
  let cursor = start;

  leadingTrace.content.forEach((c) => (acc += typeof c === 'function' ? c() : c));
  transforms.slice(start, end).forEach((transform) => {
    acc += sourceText.slice(cursor, transform.start) + transform.content;
    cursor = transform.end;
  });
  acc += sourceText.slice(cursor, end);
  tailingTrace.content.forEach((c) => (acc += typeof c === 'function' ? c() : c));

  return acc;
};
