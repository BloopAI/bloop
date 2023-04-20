import { useCallback, useContext, useEffect, useState } from 'react';
import TooltipCode from '../../TooltipCode';
import CodeToken from '../Code/CodeToken';
import { Token as TokenType } from '../../../types/prism';
import { Range } from '../../../types/results';
import { getTokenInfo } from '../../../services/api';
import { TokenInfoResponse } from '../../../types/api';
import { DeviceContext } from '../../../context/deviceContext';

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

let prevEventSource: EventSource | undefined;

const Token = ({
  language,
  token,
  lineHoverRanges,
  repoName,
  relativePath,
  repoPath,
  onRefDefClick,
}: Props) => {
  const { apiUrl } = useContext(DeviceContext);
  const [hoverableRange, setHoverableRange] = useState(
    tokenHoverable(token.byteRange, lineHoverRanges),
  );
  const [tokenInfo, setTokenInfo] = useState<TokenInfoResponse | undefined>();
  const [isLoading, setLoading] = useState(false);

  const getHoverableContent = useCallback(() => {
    if (hoverableRange && relativePath) {
      prevEventSource?.close();
      setLoading(true);
      const eventSource = new EventSource(
        `${apiUrl.replace(
          'https:',
          '',
        )}/token-info?relative_path=${relativePath}&repo_ref=${repoPath}&start=${
          hoverableRange.start
        }&end=${hoverableRange.end}`,
      );
      prevEventSource = eventSource;
      eventSource.onmessage = (ev) => {
        if (ev.data === '[DONE]') {
          eventSource.close();
          setLoading(false);
          return;
        }
        console.log(ev.data);
        const newData = JSON.parse(ev.data);

        setTokenInfo((prev) => [
          ...(prev || []),
          ...(Array.isArray(newData) ? newData : [newData]),
        ]);
      };
      eventSource.onerror = (err) => {
        console.log(err);
      };
      // getTokenInfo(
      //   relativePath,
      //   repoPath,
      //   hoverableRange.start,
      //   hoverableRange.end,
      // )
      //   .then((data) => {
      //     setTokenInfo(data);
      //   })
      //   .finally(() => {
      //     setLoading(false);
      //   });
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
      isLoading={isLoading}
    >
      <CodeToken token={token} />
    </TooltipCode>
  ) : (
    <CodeToken token={token} />
  );
};

export default Token;
