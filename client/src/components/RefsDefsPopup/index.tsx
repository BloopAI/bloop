import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TippyProps } from '@tippyjs/react';
import { Trans, useTranslation } from 'react-i18next';
import { TokenInfoType, TokenInfoWrapped } from '../../types/results';
import LiteLoaderContainer from '../Loaders/LiteLoader';
import RefDefFileItem from './RefDefFileItem';
import Badge from './Badge';

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
  onRefDefClick: (
    lineNum: number,
    filePath: string,
    tokenRange: string,
  ) => void;
  language: string;
  relativePath: string;
};

export const TypeMap = {
  REF: 'reference',
  DEF: 'definition',
} as const;

const RefsDefsPopup = ({
  placement,
  data,
  onRefDefClick,
  language,
  relativePath,
}: Props) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<TokenInfoType>(
    !data.data?.definitions?.length ? TypeMap.REF : TypeMap.DEF,
  );

  useEffect(() => {
    setFilters(!data.data?.definitions?.length ? TypeMap.REF : TypeMap.DEF);
  }, [data.data]);

  const toggleFilter = useCallback((type: TokenInfoType) => {
    setFilters(type);
  }, []);

  const tailPosition = useMemo(() => getTailPosition(placement), [placement]);

  return (
    <div className="relative py-2.5 w-fit z-10 drop-shadow-md">
      <span
        className={`absolute ${
          positionMap[tailPosition.horizontal].tail
        } w-5 h-5 border border-bg-border ${
          tailStyles[tailPosition.vertical].tail
        } transform rotate-45 box-border z-[-1] rounded-sm`}
      />

      <div className="flex flex-col w-96 rounded-lg overflow-hidden border border-bg-border bg-bg-shade z-10">
        <span
          className={`absolute ${
            positionMap[tailPosition.horizontal].fixBorder
          } w-[11.52px] h-[1px] bg-bg-shade ${
            tailStyles[tailPosition.vertical].fixture
          } border-l-[1px] border-r-[1px] border-b-transparent border-l-bg-border-hover border-r-bg-border`}
        />
        <div className="bg-bg-base h-10 flex-shrink-0 px-2.5 border-b border-bg-border flex items-center gap-2 shadow-low">
          <Badge
            type={TypeMap.DEF}
            onClick={toggleFilter}
            active={filters === TypeMap.DEF}
            disabled={!data.data.definitions?.length}
            tooltipText={t('The line of code where identifier is defined')}
          />
          <Badge
            type={TypeMap.REF}
            onClick={toggleFilter}
            active={filters === TypeMap.REF}
            disabled={!data.data.references?.length}
            tooltipText={t(
              'The line of code where the identifier is referenced',
            )}
          />
        </div>
        {!data.data?.references?.length && !data.data?.definitions?.length ? (
          <div className="bg-bg-sub rounded-b p-8 flex flex-col items-center gap-3 text-center text-label-base select-none">
            {data.isLoading ? (
              <>
                <LiteLoaderContainer />
                <p className="body-s">
                  <Trans>Searching...</Trans>
                </p>
              </>
            ) : (
              <>
                <p className="body-s text-label-title">
                  <Trans>No references or definitions found</Trans>
                </p>
                <p className="caption text-label-muted">
                  <Trans>
                    We weren&apos;t able to identify any references at the
                    moment
                  </Trans>
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-auto max-h-80">
            {data.data[
              filters === TypeMap.DEF ? 'definitions' : 'references'
            ].map((item, i) => (
              <RefDefFileItem
                onRefDefClick={onRefDefClick}
                data={item.data}
                file={item.file}
                language={language}
                key={item.file + i}
                relativePath={relativePath}
                kind={filters === TypeMap.DEF ? TypeMap.DEF : TypeMap.REF}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RefsDefsPopup;
