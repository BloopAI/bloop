import { useCallback, useEffect, useState } from 'react';
import Tippy, { TippyProps } from '@tippyjs/react';
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

let prevEventSource: EventSource;

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
  const [info, setInfo] = useState('');

  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    definitions: [],
    references: [],
  });

  const getHoverableContent = useCallback(
    (hoverableRange: Range) => {
      if (hoverableRange && relativePath) {
        // getTokenInfo(
        //   relativePath,
        //   repoPath,
        //   hoverableRange.start,
        //   hoverableRange.end,
        // ).then((data) => {
        //   setTokenInfo(mapTokenInfoData(data));
        // });
        prevEventSource?.close();
        prevEventSource = new EventSource(
          `http://localhost:7878/api/trace?relative_path=${encodeURIComponent(
            relativePath,
          )}&repo_ref=${encodeURIComponent(repoPath)}&start=${
            hoverableRange.start
          }&end=${hoverableRange.end}`,
        );
        prevEventSource.onmessage = (resp) => {
          console.log(resp.data);
          if (resp.data === '[DONE]') {
            prevEventSource.close();
            return;
          }
          const data = JSON.parse(resp.data);
          if (data.Ok) {
            setInfo((prev) => prev + data.Ok);
          }
        };
        prevEventSource.onerror = console.log;
      }
    },
    [relativePath],
  );

  useEffect(() => {
    return () => {
      prevEventSource?.close();
    };
  }, []);

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
    <Tippy
      interactive
      trigger="click"
      appendTo={(ref) => ref.ownerDocument.body}
      onShow={onHover}
      hideOnClick="toggle"
      render={() => (
        <div className="max-w-[300px] bg-gray-900 p-4 border border-gray-700 caption">
          <pre className="whitespace-pre-wrap">{info}</pre>
        </div>
      )}
    >
      <span className={'cursor-pointer'}>
        <CodeToken token={token} />
      </span>
    </Tippy>
  ) : (
    <CodeToken token={token} />
  );
};

export default Token;
