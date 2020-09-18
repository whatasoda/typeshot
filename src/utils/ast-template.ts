import type ts from 'typescript';
import { forEachChildDeep } from './ast';

interface MutableTemplateStringsArray extends Array<string> {
  raw: string[];
}

export abstract class AstTemplate<T, U extends any[]> {
  private isAccumulator: boolean = false;
  private isFreezed: boolean = false;
  protected template: MutableTemplateStringsArray;
  protected substitutions: T[];
  protected abstract getSubstitution(node: ts.Node): T | null;
  protected abstract serializeSubstitution(substitution: T, ...args: U): string;

  constructor(node: null, sourceText?: never);
  constructor(node: ts.Node, sourceText: string);
  constructor(node: ts.Node | null, sourceText: string = '') {
    const raw: string[] = [];
    this.template = Object.assign(raw, { raw });
    this.substitutions = [];
    if (!node) {
      this.isAccumulator = true;
      return;
    }

    let cursor = node.getStart();
    forEachChildDeep(node, (node) => {
      const substitution = this.getSubstitution(node);
      if (substitution === null) return;
      this.template.push(sourceText.slice(cursor, node.getStart()));
      this.substitutions.push(substitution);
      cursor = node.getEnd();
      return true;
    });

    this.template.push(sourceText.slice(cursor, node.getEnd()));
  }

  public serialize(...args: U): string {
    let acc = '';
    this.substitutions.forEach((substitution, i) => {
      acc += this.template[i];
      acc += this.serializeSubstitution(substitution, ...args);
    });
    acc += this.template[this.template.length - 1];
    return acc;
  }

  public append(templates: this[], separator: string = ''): this {
    if (!this.isAccumulator) throw new Error('DONT use AstTemplate.prototype.append with non-accumulator instance.');
    if (this.isFreezed) return this;
    const { template, substitutions } = this;
    const ignoreIndex = (template[0] = template[0] || '') === '' ? 0 : -1;
    templates.forEach(({ template: t, substitutions: s }, i) => {
      template[template.length - 1] += (i === ignoreIndex ? '' : separator) + t[0];
      template.push(...t.slice(1));
      substitutions.push(...s);
    });
    return this;
  }

  public wrap(start: string, end: string): this {
    if (this.isFreezed) return this;
    const { template: t } = this;
    t[0] = start + t[0];
    t[t.length - 1] += end;
    return this;
  }

  public ensureEnd(end: string): this {
    if (this.isFreezed) return this;
    const { template: t } = this;
    const last = t[t.length - 1];
    t[t.length - 1] = last.trimEnd().endsWith(end) ? last : last + end;
    return this;
  }

  public freeze() {
    this.isFreezed = true;
  }
}
