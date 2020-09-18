import ts from 'typescript';
import { TraceBreakTemplate } from '../typeshot';
import { getNodeByStack } from '../utils/ast';
import { CodeStack } from '../utils/stack-tracking';

export interface TraceBreak {
  stack: CodeStack;
  content: TraceBreakTemplate;
}
export class SourceTrace {
  public start: number = 0;
  public end: number = 0;
  constructor(public readonly leadingTrace: TraceBreak, public readonly tailingTrace: TraceBreak) {}
}

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
