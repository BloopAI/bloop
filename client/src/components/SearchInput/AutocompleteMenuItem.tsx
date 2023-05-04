import React from 'react';
import CodeBlockSearch from '../CodeBlock/Search';
import { ResultItemType, SuggestionType } from '../../types/results';

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
};

const AutocompleteMenuItem = ({ getItemProps, item, index }: Props) => {
  return (
    <li
      {...getItemProps({ item, index })}
      tabIndex={0}
      className={`text-label-base cursor-pointer w-full flex justify-between items-center outline-0 outline-none ${
        item.type === ResultItemType.FLAG ? 'h-9' : ''
      } px-1.5 py-2.5 hover:bg-bg-base-hover gap-1 border-transparent border-l-2 hover:border-bg-main group 
      focus:outline-none arrow-navigate focus:border-bg-main focus:bg-bg-base-hover transition duration-150 ease-in-slow`}
    >
      {item.type === ResultItemType.FLAG ||
      item.type === ResultItemType.LANG ? (
        <span className="caption flex-1">{item.data}</span>
      ) : item.type === ResultItemType.CODE ? (
        <CodeBlockSearch
          snippets={item.snippets?.slice(0, 1)}
          language={item.language}
          filePath={item.relativePath}
          repoName={item.repoName}
          branch={item.branch}
          collapsed={false}
          onClick={() => {}}
          repoPath={item.repoPath}
        />
      ) : item.type === ResultItemType.FILE ? (
        <>
          <span className="caption flex-1">{item.relativePath}</span>
          <span className="p-1 bg-bg-base rounded-sm caption text-label-muted group-hover:bg-bg-base-hover group-hover:text-label-title group-focus:bg-bg-base-hover group-focus:text-label-title transition duration-150 ease-in-slow">
            File
          </span>
        </>
      ) : item.type === ResultItemType.REPO ? (
        <>
          <span className="caption flex-1">{item.repository}</span>
          <span className="p-1 bg-bg-base rounded-sm caption text-label-muted group-hover:bg-bg-base-hover group-hover:text-label-title group-focus:bg-bg-base-hover group-focus:text-label-title transition duration-150 ease-in-slow">
            Repository
          </span>
        </>
      ) : null}
    </li>
  );
};

export default AutocompleteMenuItem;
