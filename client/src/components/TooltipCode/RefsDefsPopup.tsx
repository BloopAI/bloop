import React, { useCallback, useMemo, useState } from 'react';
import { TippyProps } from '@tippyjs/react';
import BreadcrumbsPath from '../BreadcrumbsPath';
import Code from '../CodeBlock/Code';
import { TokenInfoType, TokenInfoWrapped } from '../../types/results';
import Badge from './Badge';
import { TypeMap } from './index';

const colorMap = {
  [TypeMap.REF]: 'text-bg-danger',
  [TypeMap.DEF]: 'text-bg-success',
};

const positionMap = {
  left: { tail: 'left-1', fixBorder: 'left-[8.38px]' },
  center: {
    tail: 'left-1/2 -translate-x-1/2',
    fixBorder: 'left-[13px] left-1/2 -translate-x-1/2 transform',
  },
  right: { tail: 'right-2', fixBorder: 'right-[12.3px]' },
};

const tailStyles = {
  top: {
    tail: 'bg-bg-shade top-2',
    fixture: 'border-b-[1px] border-bg-border top-[10px]',
  },
  bottom: {
    tail: 'bg-bg-shade bottom-2',
    fixture: 'border-t-[1px] border-bg-border bottom-[10px]',
  },
};

const getTailPosition = (
  placement: TippyProps['placement'],
): {
  horizontal: 'left' | 'center' | 'right';
  vertical: 'bottom' | 'top';
} => {
  return {
    horizontal: placement?.endsWith('start')
      ? 'left'
      : placement?.endsWith('end')
      ? 'right'
      : 'center',
    vertical: placement?.startsWith('top') ? 'bottom' : 'top',
  };
};

type Props = {
  placement: TippyProps['placement'];
  data: TokenInfoWrapped;
  repoName: string;
  onRefDefClick: (lineNum: number, filePath: string) => void;
  language: string;
};

const RefsDefsPopup = ({
  placement,
  data,
  repoName,
  onRefDefClick,
  language,
}: Props) => {
  const [filters, setFilters] = useState<TokenInfoType[]>([
    TypeMap.REF,
    TypeMap.DEF,
  ]);

  const toggleFilter = useCallback((type: TokenInfoType) => {
    setFilters((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  }, []);

  const tailPosition = useMemo(() => getTailPosition(placement), [placement]);

  const references = useMemo(() => {
    return data.data.filter(
      (d) => d.data.filter((t) => t.kind === TypeMap.REF).length,
    );
  }, [data.data]);

  const definitions = useMemo(() => {
    return data.data.filter(
      (d) => d.data.filter((t) => t.kind === TypeMap.DEF).length,
    );
  }, [data.data]);

  return !data.data?.length ? null : (
    <div className="relative py-[10px] w-fit z-10">
      <span
        className={`absolute ${
          positionMap[tailPosition.horizontal].tail
        } w-5 h-5 border border-bg-border ${
          tailStyles[tailPosition.vertical].tail
        } transform rotate-45 box-border z-[-1] rounded-sm`}
      />

      <div className="flex flex-col w-96 rounded border border-bg-border z-10">
        <span
          className={`absolute ${
            positionMap[tailPosition.horizontal].fixBorder
          } w-[11.52px] h-[1px] bg-bg-shade ${
            tailStyles[tailPosition.vertical].fixture
          } border-l-[1px] border-r-[1px] border-b-transparent border-l-bg-border-hover border-r-bg-border`}
        />
        <div className="bg-bg-shade px-3 py-2 rounded-t border-b border-bg-border flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Badge
              type={TypeMap.DEF}
              onClick={toggleFilter}
              active={filters.includes(TypeMap.DEF)}
              disabled={!definitions?.length}
              tooltipText="The line of code where identifier is defined"
            />
            <Badge
              type={TypeMap.REF}
              onClick={toggleFilter}
              active={filters.includes(TypeMap.REF)}
              disabled={!references?.length}
              tooltipText="The line of code where the identifier is referenced"
            />
          </div>
        </div>
        <div className="bg-bg-base rounded-b text-xs overflow-auto max-h-80">
          {data.data
            .filter(
              (d) => d.data.filter((dd) => filters.includes(dd.kind)).length,
            )
            .map((d, i) => (
              <div className="border-b border-bg-border" key={d.file + i}>
                <div className="px-3 pt-2">
                  <BreadcrumbsPath
                    path={d.file}
                    repo={repoName}
                    activeStyle="secondary"
                  />
                </div>
                {d.data
                  .filter((dd) => filters.includes(dd.kind))
                  .map((line, i) => (
                    <div
                      key={i}
                      className="py-2 px-3 code-s flex gap-1 cursor-pointer overflow-auto"
                      onClick={() =>
                        onRefDefClick(line.snippet.line_range.start, d.file)
                      }
                    >
                      <div
                        className={`uppercase caption w-8 flex-shrink-0 flex-grow-0 ${
                          colorMap[line.kind]
                        }`}
                      >
                        {line.kind.slice(0, 3)}
                      </div>
                      <Code
                        code={line.snippet.data}
                        lineStart={line.snippet.line_range.start}
                        highlights={line.snippet.highlights}
                        language={language}
                        removePaddings
                        lineHoverEffect
                      />
                    </div>
                  ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default RefsDefsPopup;
