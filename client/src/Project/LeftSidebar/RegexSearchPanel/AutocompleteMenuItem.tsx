import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Trans } from 'react-i18next';
import { ResultItemType, SuggestionType } from '../../../types/results';
import CodeBlockSearch from '../../../components/Code/CodeBlockSearch';

type Props = {
  item: SuggestionType;
  index: number;
  getItemProps: ({
    item,
    index,
  }: {
    item: SuggestionType;
    index: number;
  }) => any;
  isFocused: boolean;
  isFirst: boolean;
};

const AutocompleteMenuItem = ({
  getItemProps,
  item,
  index,
  isFocused,
  isFirst,
}: Props) => {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const snippets = useMemo(() => {
    if (item.type === ResultItemType.CODE) {
      return item.snippets?.slice(0, 1).map((s) => ({
        ...s,
        code: s.code.split('\n').slice(0, 5).join('\n'), // don't render big snippets that have over 5 lines
      }));
    }
    return [];
  }, [item]);

  return (
    <li
      {...getItemProps({ item, index })}
      ref={ref}
      tabIndex={0}
      className={`text-label-base cursor-pointer w-full flex justify-between items-center ${
        isFirst ? 'scroll-mt-8' : ''
      } outline-0 outline-none ${
        item.type === ResultItemType.FLAG ? 'h-9' : ''
      } px-1.5 py-2.5 hover:bg-bg-base-hover gap-1 border-transparent border-l-2 hover:border-bg-main group 
      ${
        isFocused ? 'bg-bg-shade-hover' : 'focus:bg-bg-shade-hover'
      } transition duration-150 ease-in-out`}
    >
      {item.type === ResultItemType.FLAG ||
      item.type === ResultItemType.LANG ? (
        <span className="caption flex-1">{item.data}</span>
      ) : item.type === ResultItemType.CODE ? (
        <CodeBlockSearch
          snippets={snippets}
          language={item.language}
          filePath={item.relativePath}
          collapsed={false}
          repoRef={item.repoRef}
        />
      ) : item.type === ResultItemType.FILE ? (
        <>
          <span className="caption flex-1">{item.relativePath}</span>
          <span className="p-1 bg-bg-base rounded-sm caption text-label-muted group-hover:bg-bg-base-hover group-hover:text-label-title group-focus:bg-bg-base-hover group-focus:text-label-title transition duration-150 ease-in-slow">
            <Trans>File</Trans>
          </span>
        </>
      ) : item.type === ResultItemType.REPO ? (
        <>
          <span className="caption flex-1">{item.repoName}</span>
          <span className="p-1 bg-bg-base rounded-sm caption text-label-muted group-hover:bg-bg-base-hover group-hover:text-label-title group-focus:bg-bg-base-hover group-focus:text-label-title transition duration-150 ease-in-slow">
            <Trans>Repository</Trans>
          </span>
        </>
      ) : null}
    </li>
  );
};

export default memo(AutocompleteMenuItem);
