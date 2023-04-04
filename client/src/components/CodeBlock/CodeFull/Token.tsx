import { useCallback, useEffect, useState } from 'react';
import TooltipCode from '../../TooltipCode';
import CodeToken from '../Code/CodeToken';
import { Token as TokenType } from '../../../types/prism';
import { Range } from '../../../types/results';
import { getTokenInfo } from '../../../services/api';
import { TokenInfoResponse } from '../../../types/api';

type Props = {
  language: string;
  token: TokenType;
  relativePath: string;
  repoName: string;
  lineHoverRanges: Range[];
  repoPath: string;
  onRefDefClick: (line: number, filePath: string) => void;
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
  language,
  token,
  lineHoverRanges,
  repoName,
  relativePath,
  repoPath,
  onRefDefClick,
}: Props) => {
  const [hoverableRange, setHoverableRange] = useState(
    tokenHoverable(token.byteRange, lineHoverRanges),
  );
  const [tokenInfo, setTokenInfo] = useState<TokenInfoResponse | undefined>();

  const getHoverableContent = useCallback(() => {
    if (hoverableRange && relativePath) {
      getTokenInfo(
        relativePath,
        repoPath,
        hoverableRange.start,
        hoverableRange.end,
      ).then((data) => {
        setTokenInfo(data);
      });
    }
  }, [relativePath, hoverableRange]);

  useEffect(() => {
    setHoverableRange(tokenHoverable(token.byteRange, lineHoverRanges));
  }, [token, lineHoverRanges]);

  const onHover = useCallback(() => {
    if (!document.getSelection()?.toString()) {
      getHoverableContent();
    }
  }, [getHoverableContent]);

  const handleRefsDefsClick = useCallback((line: number, filePath: string) => {
    setTokenInfo(undefined);
    onRefDefClick(line, filePath);
  }, []);

  return hoverableRange ? (
    <TooltipCode
      language={language}
      data={tokenInfo}
      position={'left'}
      onHover={onHover}
      repoName={repoName}
      onRefDefClick={handleRefsDefsClick}
      queryParams={`relative_path=${encodeURIComponent(
        relativePath,
      )}&repo_ref=${encodeURIComponent(repoPath)}&start=${
        hoverableRange.start
      }&end=${hoverableRange.end}`}
    >
      <CodeToken token={token} />
    </TooltipCode>
  ) : (
    <CodeToken token={token} />
  );
};

export default Token;
