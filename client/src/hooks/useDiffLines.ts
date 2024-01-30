import { useMemo } from 'react';
import { Token } from '../types/prism';

export const useDiffLines = (tokens: Token[][], isDisabled?: boolean) => {
  const lineNumbersAdd = useMemo(() => {
    if (isDisabled) {
      return [];
    }
    let curr = 0;
    return tokens.map((line) => {
      if (line[0]?.content === '-' || line[1]?.content === '-') {
        return null;
      } else {
        curr++;
        return curr;
      }
    });
  }, [tokens, isDisabled]);
  const lineNumbersRemove = useMemo(() => {
    if (isDisabled) {
      return [];
    }
    let curr = 0;
    return tokens.map((line) => {
      if (line[0]?.content === '+' || line[1]?.content === '+') {
        return null;
      } else {
        curr++;
        return curr;
      }
    });
  }, [tokens, isDisabled]);

  return { lineNumbersAdd, lineNumbersRemove };
};
