import React, { memo, useCallback, useState } from 'react';
import { SnippetItem } from '../../../../types/api';
import { ChevronRightIcon } from '../../../../icons';
import FileIcon from '../../../../components/FileIcon';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';
import CodeLine from './CodeLine';

type Props = {
  relative_path: string;
  repo_ref: string;
  lang: string;
  snippets: SnippetItem[];
  index: string;
  isFirst: boolean;
};

const CodeResult = ({
  relative_path,
  repo_ref,
  lang,
  snippets,
  index,
  isFirst,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const onClick = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const { isFocused, props } = useArrowNavigationItemProps<HTMLDivElement>(
    index,
    onClick,
  );

  return (
    <div className="relative flex flex-col">
      <span className="absolute top-7 bottom-0 left-11.5 w-px bg-bg-border" />
      <div
        className={`flex w-max min-w-full items-center gap-3 whitespace-nowrap body-mini text-label-title h-7 flex-shrink-0 ${
          isFirst ? 'scroll-mt-10' : ''
        } ${isFocused ? 'bg-bg-shade-hover' : ''} pl-10 pr-4 cursor-pointer`}
        {...props}
      >
        <ChevronRightIcon
          sizeClassName="w-3.5 h-3.5"
          className={`${
            isExpanded ? 'rotate-90' : 'rotate-0'
          } transition-transform duration-150 ease-in-out`}
        />
        <FileIcon filename={relative_path} noMargin />
        {/*<BreadcrumbsPathContainer*/}
        {/*  path={relative_path}*/}
        {/*  onClick={handleClick}*/}
        {/*  repo={repo_ref}*/}
        {/*/>*/}
        <div>{relative_path}</div>
      </div>
      <ul className="">
        {isExpanded
          ? snippets.map((s, i) => (
              <CodeLine
                key={i}
                code={s.data}
                path={relative_path}
                language={lang}
                repoRef={repo_ref}
                lineStart={s.line_range.start}
                lineEnd={s.line_range.end}
                highlights={s.highlights}
                index={`${index}-${i}`}
              />
            ))
          : null}
      </ul>
    </div>
  );
};

export default memo(CodeResult);
