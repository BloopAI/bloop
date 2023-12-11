import React, { memo, useCallback } from 'react';
import { DefIcon, RefIcon } from '../../icons';
import CodeFragment from '../Code/CodeFragment';
import { Range, TokenInfoType } from '../../types/results';
import { TypeMap } from './index';

type Props = {
  kind: TokenInfoType;
  onRefDefClick: (
    lineNum: number,
    filePath: string,
    tokenRange: string,
  ) => void;
  snippet: {
    data: string;
    highlights: Range[];
    tokenRange?: Range | undefined;
    symbols: never[];
    line_range: Range;
  };
  file: string;
  range: {
    start: { byte: number; line: number; column: number };
    end: { byte: number; line: number; column: number };
  };
  language: string;
};

const RefDefFileLine = ({
  kind,
  onRefDefClick,
  snippet,
  file,
  range,
  language,
}: Props) => {
  const onClick = useCallback(() => {
    onRefDefClick(
      snippet.line_range.start,
      file,
      `${range.start?.byte}_${range.end?.byte}`,
    );
  }, [onRefDefClick, snippet, file, kind, range]);

  return (
    <div
      className="h-10 flex-shrink-0 pr-3 pl-10 code-mini flex gap-1.5 items-center cursor-pointer overflow-auto hover:bg-bg-shade-hover"
      onClick={onClick}
    >
      {kind === TypeMap.DEF ? (
        <DefIcon sizeClassName="w-3.5 h-3.5" className="text-label-muted" />
      ) : (
        <RefIcon sizeClassName="w-3.5 h-3.5" className="text-label-muted" />
      )}
      <CodeFragment
        code={snippet.data}
        lineStart={snippet.line_range.start}
        highlights={snippet.highlights}
        language={language}
        removePaddings
        lineHoverEffect
      />
    </div>
  );
};

export default memo(RefDefFileLine);
