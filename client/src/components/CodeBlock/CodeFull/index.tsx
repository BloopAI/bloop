import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import debounce from 'lodash.debounce';
import {
  Table as _Table,
  AutoSizer as _AutoSizer,
  AutoSizerProps,
  TableProps,
} from 'react-virtualized';
import { useSearchParams } from 'react-router-dom';
import MiniMap from '../MiniMap';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import { Range, TokenInfoItem } from '../../../types/results';
import CodeLine from '../Code/CodeLine';
import { hashCode } from '../../../utils';
import { Commit } from '../../../types';
import { Token as TokenType } from '../../../types/prism';
import useAppNavigation from '../../../hooks/useAppNavigation';
import Token from './Token';

const Table = _Table as unknown as FC<TableProps>;
const AutoSizer = _AutoSizer as unknown as FC<AutoSizerProps>;

interface BlameLine {
  start: boolean;
  commit?: Commit;
}

interface GitBlame {
  lineRange: Range;
  commit: Commit;
}

interface Metadata {
  lexicalBlocks: Range[];
  hoverableRanges: Record<number, Range[]>;
  blame?: GitBlame[];
}

type Props = {
  code: string;
  language: string;
  metadata: Metadata;
  minimap?: boolean;
  scrollElement: HTMLDivElement | null;
  relativePath: string;
  repoPath: string;
  repoName: string;
};

const CodeFull = ({
  language,
  code,
  metadata,
  scrollElement,
  minimap,
  relativePath,
  repoPath,
  repoName,
}: Props) => {
  const [foldableRanges, setFoldableRanges] = useState<Record<number, number>>(
    {},
  );
  const [searchParams] = useSearchParams();
  const [foldedLines, setFoldedLines] = useState<Record<number, number>>({});
  const [blameLines, setBlameLines] = useState<Record<number, BlameLine>>({});
  const scrollLineNumber = useMemo(
    () =>
      searchParams
        .get('scroll_line_index')
        ?.split('_')
        .map((i) => Number(i)),
    [searchParams],
  );
  const [scrollToIndex, setScrollToIndex] = useState(
    scrollLineNumber || undefined,
  );
  const { navigateRepoPath } = useAppNavigation();

  useEffect(() => {
    setScrollToIndex(scrollLineNumber || undefined);
  }, [scrollLineNumber]);

  const lang = useMemo(
    () => getPrismLanguage(language) || 'plaintext',
    [language],
  );

  useEffect(() => {
    setFoldableRanges(
      metadata.lexicalBlocks?.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.start]: cur.end,
        }),
        {},
      ) || {},
    );
  }, [metadata.lexicalBlocks]);

  useEffect(() => {
    const bb: Record<number, BlameLine> = {};
    metadata.blame?.forEach((item) => {
      bb[item.lineRange.start] = {
        start: true,
        commit: item.commit,
      };
      bb[item.lineRange.end] = {
        start: false,
      };
    });

    setBlameLines(bb);
  }, [metadata.blame]);

  const toggleBlock = useCallback(
    (fold: boolean, start: number) => {
      for (let i = start + 1; i < foldableRanges[start]; i++) {
        setFoldedLines((prevState) =>
          fold
            ? { ...prevState, [i]: i }
            : {
                ...(prevState[i] !== i ? prevState : {}),
              },
        );
      }
    },
    [foldableRanges],
  );

  const [scrollPosition, setScrollPosition] = useState(0);
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = debounce((val) => {
      setScrollPosition((val.target as HTMLDivElement).scrollTop || 0);
    }, 300);

    scrollElement?.addEventListener('scroll', handleScroll);
    return () => scrollElement?.removeEventListener('scroll', handleScroll);
  });

  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

  const pathHash = useMemo(
    () => (relativePath ? hashCode(relativePath) : ''),
    [relativePath],
  ); // To tell if code has changed

  const onRefDefClick = useCallback(
    (item: TokenInfoItem, filePath: string) => {
      if (filePath === relativePath) {
        setScrollToIndex([item.line, item.line]);
      } else {
        navigateRepoPath(repoName, filePath, {
          scroll_line_index: `${item.line}_${item.line}`,
        });
      }
    },
    [repoName, relativePath],
  );
  console.log(scrollToIndex);
  return (
    <div className="w-full text-xs gap-10 flex flex-row">
      <div className={`${!minimap ? 'w-full' : ''}`} ref={codeRef}>
        <pre
          className={`prism-code language-${lang} bg-gray-900 my-0 w-full h-full`}
        >
          <AutoSizer>
            {({ height, width }) => (
              <Table
                width={width}
                height={height}
                headerHeight={0}
                rowHeight={20}
                rowCount={tokens.length}
                rowGetter={({ index }) => tokens[index]}
                scrollToIndex={scrollToIndex?.[0]}
                scrollToAlignment="center"
                rowRenderer={(props) => (
                  <CodeLine
                    key={pathHash + '-' + props.index.toString()}
                    lineNumber={props.index}
                    lineFoldable={!!foldableRanges[props.index]}
                    handleFold={toggleBlock}
                    showLineNumbers={true}
                    lineHidden={!!foldedLines[props.index]}
                    blameLine={blameLines[props.index]}
                    blame={!!metadata.blame?.length}
                    hoverEffect
                    shouldHighlight={
                      scrollToIndex &&
                      props.index >= scrollToIndex[0] &&
                      props.index <= scrollToIndex[1]
                    }
                    stylesGenerated={{
                      ...props.style,
                      width: 'auto',
                      minWidth: width,
                      overflow: 'auto',
                    }}
                  >
                    {props.rowData.map((token: TokenType, key: string) => (
                      <Token
                        key={key}
                        lineHoverRanges={metadata.hoverableRanges[props.index]}
                        language={language}
                        token={token}
                        repoName={repoName}
                        relativePath={relativePath}
                        repoPath={repoPath}
                        onRefDefClick={onRefDefClick}
                      />
                    ))}
                  </CodeLine>
                )}
              ></Table>
            )}
          </AutoSizer>
        </pre>
      </div>
      {minimap && (
        <div className="w-36">
          <MiniMap
            code={code}
            language={language}
            codeFullHeight={scrollElement?.scrollHeight || 0}
            codeVisibleHeight={scrollElement?.clientHeight || 0}
            codeScroll={scrollPosition}
            handleScroll={(v) => {
              scrollElement?.scrollTo(0, v);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CodeFull;
