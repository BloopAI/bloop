import React, { useCallback, useMemo, useState } from 'react';
import { TippyProps } from '@tippyjs/react';
import { TokenInfoType, TokenInfoWrapped } from '../../types/results';
import { Def, Ref } from '../../icons';
import LiteLoaderContainer from '../Loaders/LiteLoader';
import Badge from './Badge';
import RefDefItem from './RefDefItem';
import { TypeMap } from './index';

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
  relativePath: string;
};

const RefsDefsPopup = ({
  placement,
  data,
  repoName,
  onRefDefClick,
  language,
  relativePath,
}: Props) => {
  const [filters, setFilters] = useState<TokenInfoType[]>([
    TypeMap.REF,
    TypeMap.DEF,
  ]);

  const toggleFilter = useCallback((type: TokenInfoType) => {
    setFilters((prev) => {
      if (type === TypeMap.REF && prev.includes(type)) {
        return prev.length === 1 ? [type] : [TypeMap.DEF];
      } else if (!prev.includes(type)) {
        return [...prev, type];
      } else if (type === TypeMap.DEF && prev.includes(type)) {
        return prev.length === 1 ? [type] : [TypeMap.REF];
      }
      return [...prev, type];
    });
  }, []);

  const tailPosition = useMemo(() => getTailPosition(placement), [placement]);

  return (
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
              disabled={!data.data.definitions?.length}
              tooltipText="The line of code where identifier is defined"
            />
            <Badge
              type={TypeMap.REF}
              onClick={toggleFilter}
              active={filters.includes(TypeMap.REF)}
              disabled={!data.data.references?.length}
              tooltipText="The line of code where the identifier is referenced"
            />
          </div>
        </div>
        {!data.data?.references?.length && !data.data?.definitions?.length ? (
          <div className="bg-bg-sub rounded-b p-8 flex flex-col items-center gap-3 text-center text-label-base select-none">
            {data.isLoading ? (
              <>
                <LiteLoaderContainer />
                <p className="body-s">Searching...</p>
              </>
            ) : (
              <>
                <p className="body-s text-label-title">
                  No references or definitions found
                </p>
                <p className="caption text-label-muted">
                  We weren&apos;t able to identify any references at the moment
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-bg-sub rounded-b text-xs overflow-auto max-h-80">
            {filters.includes(TypeMap.DEF) &&
              !!data.data.definitions.length && (
                <div>
                  <div className="bg-bg-base flex gap-1 items-center py-2 px-3 text-bg-success select-none">
                    <Def raw sizeClassName="w-3.5 h-3.5" />
                    <p className="caption text-label-base">Definitions</p>
                  </div>
                  {data.data.definitions.map((item, i) => {
                    return (
                      <RefDefItem
                        onRefDefClick={onRefDefClick}
                        data={item.data}
                        file={item.file}
                        repoName={repoName}
                        language={language}
                        key={item.file + i}
                        relativePath={relativePath}
                        kind={TypeMap.DEF}
                      />
                    );
                  })}
                </div>
              )}
            {filters.includes(TypeMap.REF) && !!data.data.references.length && (
              <div>
                <div className="bg-bg-base flex gap-1 items-center py-2 px-3 text-bg-danger select-none">
                  <Ref raw sizeClassName="w-3.5 h-3.5" />
                  <p className="caption text-label-base">References</p>
                </div>
                {data.data.references.map((item, i) => {
                  return (
                    <RefDefItem
                      onRefDefClick={onRefDefClick}
                      data={item.data}
                      file={item.file}
                      relativePath={relativePath}
                      repoName={repoName}
                      language={language}
                      key={item.file + i}
                      kind={TypeMap.REF}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RefsDefsPopup;
