import { getContext } from '../program/context';
import { CodeStack, withStackTracking } from '../utils/stack-tracking';
import { reduceTaggedTemplate } from '../utils/tagged-template';

export type SourceTraceTemplate = (string | (() => string))[];

/** @private */
export interface TraceBreakpoint {
  stack: CodeStack;
  content: SourceTraceTemplate;
}

export type { SourceTrace };
/** @private */
class SourceTrace {
  public start: number = 0;
  public end: number = 0;
  constructor(public readonly leadingTrace: TraceBreakpoint, public readonly tailingTrace: TraceBreakpoint) {}
}

export const isSourceTrace = (value: any): value is SourceTrace => value instanceof SourceTrace;

const empty: TemplateStringsArray = Object.assign([], { raw: [] });

export const openTrace: {
  (template?: TemplateStringsArray, ...substitutions: SourceTraceTemplate): void;
} = withStackTracking((stack, template = empty, ...substitutions) => {
  const context = getContext();
  if (context.pendingTrace) throw new Error('Make sure to close existing trace before opening another trace');

  const content = reduceTaggedTemplate([], template, substitutions, (s) => s);
  context.pendingTrace = { stack, content };
});

export const closeTrace: {
  (template?: TemplateStringsArray, ...substitutions: SourceTraceTemplate): void;
} = withStackTracking((stack, template = empty, ...substitutions) => {
  const context = getContext();
  if (!context.pendingTrace) throw new Error(`Make sure to open trace before closing trace`);

  const content = reduceTaggedTemplate([], template, substitutions, (s) => s);
  context.template.push(new SourceTrace(context.pendingTrace, { stack, content }));
  context.pendingTrace = null;
});
