import { useCallback, useEffect, useState } from 'react';
import TooltipCode from '../../TooltipCode';
import CodeToken from '../Code/CodeToken';
import { Token as TokenType } from '../../../types/prism';
import { Range, TokenInfo, TokenInfoItem } from '../../../types/results';
import { getTokenInfo } from '../../../services/api';
import { mapTokenInfoData } from '../../../mappers/results';

type Props = {
  language: string;
  token: TokenType;
  relativePath: string;
  repoName: string;
  lineHoverRanges: Range[];
  repoPath: string;
  onRefDefClick: (item: TokenInfoItem, filePath: string) => void;
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

  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    definitions: [],
    references: [],
  });

  const getHoverableContent = useCallback(
    (hoverableRange: Range) => {
      if (hoverableRange && relativePath) {
        getTokenInfo(
          relativePath,
          repoPath,
          hoverableRange.start,
          hoverableRange.end,
        ).then((data) => {
          setTokenInfo(mapTokenInfoData(data));
        });
      }
    },
    [relativePath],
  );

  useEffect(() => {
    setHoverableRange(tokenHoverable(token.byteRange, lineHoverRanges));
  }, [token, lineHoverRanges]);

  const onHover = useCallback(() => {
    if (!document.getSelection()?.toString()) {
      getHoverableContent(hoverableRange!);
    }
  }, [hoverableRange]);

  const handleRefsDefsClick = useCallback(
    (item: TokenInfoItem, filePath: string) => {
      setTokenInfo({
        definitions: [],
        references: [],
      });
      onRefDefClick(item, filePath);
    },
    [],
  );

  return hoverableRange ? (
    <TooltipCode
      language={language}
      data={tokenInfo}
      position={'left'}
      onHover={onHover}
      repoName={repoName}
      onRefDefClick={handleRefsDefsClick}
    >
      <CodeToken token={token} />
    </TooltipCode>
  ) : (
    <CodeToken token={token} />
  );
};

export default Token;
