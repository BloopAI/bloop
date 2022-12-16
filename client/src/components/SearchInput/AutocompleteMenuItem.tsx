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
      className={`text-gray-300 cursor-pointer w-full flex justify-between items-center outline-0 outline-none ${
        item.type === ResultItemType.FLAG ? 'h-9' : ''
      } px-1.5 py-2.5 hover:bg-gray-700 gap-1 border-transparent border-l-2 hover:border-primary-400 group 
      focus:outline-none arrow-navigate focus:border-primary-400 focus:bg-gray-700 transition duration-150 ease-in-slow`}
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
          <span className="p-1 bg-gray-700 rounded-sm caption text-gray-500 group-hover:bg-gray-600 group-hover:text-gray-100 group-focus:bg-gray-600 group-focus:text-gray-100 transition duration-150 ease-in-slow">
            File
          </span>
        </>
      ) : item.type === ResultItemType.REPO ? (
        <>
          <span className="caption flex-1">{item.repository}</span>
          <span className="p-1 bg-gray-700 rounded-sm caption text-gray-500 group-hover:bg-gray-600 group-hover:text-gray-100 group-focus:bg-gray-600 group-focus:text-gray-100 transition duration-150 ease-in-slow">
            Repository
          </span>
        </>
      ) : null}
    </li>
  );
};

export default AutocompleteMenuItem;
