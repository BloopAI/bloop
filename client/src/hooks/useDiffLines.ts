import { useMemo } from 'react';
import { Token } from '../types/prism';

export const useDiffLines = (tokens: Token[][]) => {
  const lineNumbersAdd = useMemo(() => {
    let curr = 0;
    return tokens.map((line) => {
      if (line[0]?.content === '-' || line[1]?.content === '-') {
        return null;
      } else {
        curr++;
        return curr;
      }
    });
  }, [tokens]);
  const lineNumbersRemove = useMemo(() => {
    let curr = 0;
    return tokens.map((line) => {
      if (line[0]?.content === '+' || line[1]?.content === '+') {
        return null;
      } else {
        curr++;
        return curr;
      }
    });
  }, [tokens]);

  return { lineNumbersAdd, lineNumbersRemove };
};
