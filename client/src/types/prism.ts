import { Range } from './results';

export type PrismToken = {
  type: string | string[];
  alias: string | string[];
  content: Array<PrismToken | string> | string;
};

export type Token = {
  types: string[];
  content: string;
  empty?: boolean;
  byteRange: Range;
};
