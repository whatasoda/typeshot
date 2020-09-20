export const union = <T>(members: T[]) => new TypeKind.Union<T>(members);
export namespace TypeKind {
  export class Union<T = any> {
    constructor(public readonly members: T[]) {}
  }
}
