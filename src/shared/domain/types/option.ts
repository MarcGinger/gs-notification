export type Option<T> = Some<T> | None;

export interface Some<T> {
  readonly kind: 'some';
  readonly value: T;
}

export interface None {
  readonly kind: 'none';
}

export const Option = {
  some<T>(value: T): Option<T> {
    return { kind: 'some', value };
  },
  none<T = never>(): Option<T> {
    return { kind: 'none' };
  },

  isSome<T>(opt: Option<T>): opt is Some<T> {
    return opt.kind === 'some';
  },
  isNone<T>(opt: Option<T>): opt is None {
    return opt.kind === 'none';
  },

  map<T, U>(opt: Option<T>, fn: (val: T) => U): Option<U> {
    return Option.isSome(opt) ? Option.some(fn(opt.value)) : Option.none();
  },

  unwrapOr<T>(opt: Option<T>, defaultValue: T): T {
    return Option.isSome(opt) ? opt.value : defaultValue;
  },
};
