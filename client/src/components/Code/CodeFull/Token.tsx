import { memo, useCallback, useEffect, useState } from 'react';
import CodeToken from '../CodeToken';
import { Token as TokenType } from '../../../types/prism';
import { Range } from '../../../types/results';

type Props = {
  token: TokenType;
  lineHoverRanges?: Range[];
  getHoverableContent: (
    hoverableRange: Range,
    tokenRange: Range,
    lineNumber: number,
  ) => void;
  lineNumber: number;
  isEditingRanges?: boolean;
};

const tokenHoverable = (tokenPosition: Range, ranges: Range[]) => {
  if (!ranges) {
    return;
  }
  for (let range of ranges) {
    if (range.start >= tokenPosition.start && range.end <= tokenPosition.end) {
      return {
        start: range.start,
        end: range.end,
      };
    }
  }
};

const Token = ({
  token,
  lineHoverRanges = [],
  getHoverableContent,
  lineNumber,
  isEditingRanges,
}: Props) => {
  const [hoverableRange, setHoverableRange] = useState(
    tokenHoverable(token.byteRange, lineHoverRanges),
  );

  useEffect(() => {
    setHoverableRange(tokenHoverable(token.byteRange, lineHoverRanges));
  }, [token, lineHoverRanges]);

  const onClick = useCallback(() => {
    if (
      !document.getSelection()?.toString() &&
      hoverableRange &&
      !isEditingRanges
    ) {
      getHoverableContent(hoverableRange!, token.byteRange, lineNumber);
    }
  }, [getHoverableContent, hoverableRange, lineNumber, isEditingRanges]);

  return (
    <CodeToken
      token={token}
      isHoverable={!!hoverableRange && !isEditingRanges}
      onClick={onClick}
    />
  );
};

export default memo(Token);
