import React, { useCallback, useMemo, useState } from 'react';
import { Trans } from 'react-i18next';
import { ArrowTriangleBottomIcon } from '../../icons';
import { RefDefDataItem } from '../../types/api';
import { TokenInfoType } from '../../types/results';
import BreadcrumbsPathContainer from '../Breadcrumbs/PathContainer';
import RefDefFileLine from './RefDefFileLine';

type Props = {
  file: string;
  data: RefDefDataItem[];
  onRefDefClick: (
    lineNum: number,
    filePath: string,
    tokenRange: string,
  ) => void;
  language: string;
  kind: TokenInfoType;
  relativePath: string;
};

const RefDefFileItem = ({
  file,
  data,
  onRefDefClick,
  language,
  kind,
  relativePath,
}: Props) => {
  const [isOpen, setOpen] = useState(true);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const style = useMemo(() => {
    return {
      maxHeight: isOpen ? 40 * data.length : 0,
      animationDuration: data.length * 0.01 + 's',
    };
  }, [data.length, isOpen]);

  return (
    <div className="[&:not(:last-child)]:border-b border-bg-border" key={file}>
      <div
        className={`h-10 flex-shrink-0 px-4 flex items-center gap-4 cursor-pointer w-full ${
          isOpen ? 'text-label-title' : 'text-label-muted'
        }`}
        onClick={toggleOpen}
      >
        <ArrowTriangleBottomIcon
          sizeClassName="w-2 h-2"
          className={`flex-shrink-0 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          } transition-all duration-150`}
        />
        <div className="flex-1 overflow-hidden body-s-b">
          {file === relativePath ? (
            <p className="select-none text-left">
              <Trans>In this file</Trans>
            </p>
          ) : (
            <BreadcrumbsPathContainer
              path={file}
              activeStyle="secondary"
              separator="›"
            />
          )}
        </div>
        <p className="select-none body-s-b">{data.length}</p>
      </div>
      <div style={style} className="transition-all ease-linear overflow-hidden">
        {data.map((line, i) => (
          <RefDefFileLine
            key={i}
            onRefDefClick={onRefDefClick}
            file={file}
            language={language}
            kind={kind}
            snippet={line.snippet}
            range={line.range}
          />
        ))}
      </div>
    </div>
  );
};

export default RefDefFileItem;
