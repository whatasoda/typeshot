// DO NOT EDIT - GENERATED FILE

import type { Options } from 'prettier';
interface SomeInterface {}
type SomeType = {};

import './readme/another-file';
// eslint-disable-next-line prettier/prettier
export type a = import('./readme/another-file').Type;
export const a = import('./readme/another-file');

// typeshot-start
export interface Hoge {
  hoge: {
    name: 'hoge';
    value: SomeType;
  };
  fuga: {
    name: 'fuga';
    value: SomeInterface;
  };
  prettier: {
    name: 'prettier';
    value: Options;
  };
}

// hogehoge

// Sample

export type Sample = {
  hoge: {
    name: 'hoge';
    value: SomeType;
  };
};
export type _Sample = {
  name: 'hoge';
  value: SomeType;
};

// fuga

export type Sample0 = {
  fuga: {
    name: 'fuga';
    value: SomeInterface;
  };
};
export type _Sample0 = {
  name: 'fuga';
  value: SomeInterface;
};

export {};
