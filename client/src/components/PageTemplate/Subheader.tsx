import React, { useContext, useMemo } from 'react';
import SearchInput from '../SearchInput';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { splitPath } from '../../utils';
import Breadcrumbs, { PathParts } from '../Breadcrumbs';
import {
  ArrowJumpLeft,
  CodeIcon,
  Def,
  Ref,
  FolderFilled,
  RegexIcon,
} from '../../icons';
import FileIcon from '../FileIcon';
import BranchSelector from './BranchSelector';

const Subheader = () => {
  const { navigationHistory, navigateBack } = useContext(AppNavigationContext);

  const breadcrumbs = useMemo(() => {
    const reversedHistory = [...navigationHistory].reverse();
    const lastHomeIndex = reversedHistory.findIndex(
      (n) => n.type === 'repo' && !n.path,
    );
    let historyPart = navigationHistory;
    if (lastHomeIndex >= 0) {
      historyPart = reversedHistory.slice(0, lastHomeIndex + 1).reverse();
    }
    if (historyPart.length === 1 && historyPart[0].type === 'repo') {
      return [];
    }
    const lastResultsIndex = historyPart.findLastIndex(
      (n) => n.type === 'article-response' || n.type === 'conversation-result',
    );
    let resultsInList: boolean;
    let pathToFileInList: boolean;
    let list: PathParts[] = historyPart
      .map((item, i): (PathParts & { type: string }) | undefined => {
        const onClick = () => navigateBack(-(historyPart.length - 1 - i));
        if (item.type === 'repo' && !item.path) {
          return {
            label: item.repo!,
            onClick,
            type: 'repo',
          };
        }
        if (
          (item.type === 'repo' || item.type === 'full-result') &&
          item.path
        ) {
          const label = splitPath(item.path);
          return {
            label: (
              <div className="flex items-center gap-1">
                {label[label.length - 1] || label[label.length - 2]}{' '}
                {!!item.pathParams?.type && (
                  <div
                    className={`flex items-center gap-1 h-5 px-1 rounded-4 border border-bg-border bg-bg-shade ${
                      item.pathParams.type === 'definition'
                        ? 'text-bg-success'
                        : 'text-bg-danger'
                    }`}
                  >
                    {item.pathParams.type === 'definition' ? (
                      <Def raw sizeClassName="w-3.5 h-3.5" />
                    ) : (
                      <Ref raw sizeClassName="w-3.5 h-3.5" />
                    )}
                    <span className="text-label-base code-s">
                      {item.pathParams?.tokenName}
                    </span>
                  </div>
                )}
              </div>
            ),
            icon:
              item.type === 'full-result' ? (
                <FileIcon
                  noMargin
                  filename={label[label.length - 1] || label[label.length - 2]}
                />
              ) : (
                <FolderFilled sizeClassName="w-4 h-4" raw />
              ),
            onClick,
            type: item.type,
          };
        }
        if (
          item.type === 'conversation-result' ||
          item.type === 'article-response'
        ) {
          return {
            label: 'Results',
            icon:
              i !== historyPart.length - 1 ? (
                <CodeIcon sizeClassName="w-4 h-4" raw />
              ) : undefined,
            onClick,
            type: 'results',
          };
        }
        if (historyPart[i - 1]?.query !== item.query) {
          return {
            label: item.query || 'Regex search',
            icon: <RegexIcon sizeClassName="w-3 h-3" raw />,
            onClick,
            type: 'search',
          };
        }
      })
      .reverse()
      .filter((i, index, array): i is PathParts & { type: string } => {
        if (i?.type === 'results') {
          if (resultsInList) {
            return false; // remove clusters of Results
          }
          resultsInList = true;
        } else {
          resultsInList = false;
        }
        if (
          i?.type !== 'results' &&
          i?.type !== 'search' &&
          index !== array.length - 1
        ) {
          if (pathToFileInList && !i?.type) {
            return false; // remove clusters of navigation items
          }
          pathToFileInList = true;
        } else {
          pathToFileInList = false;
        }
        return !!i;
      })
      .reverse();
    if (
      list.length > 2 &&
      list.find((i) => i.label === 'Results') &&
      lastResultsIndex !== historyPart.length - 1
    ) {
      list = [
        ...list.slice(0, 1),
        {
          label: 'Back to results',
          icon: <ArrowJumpLeft sizeClassName="w-4 h-4" raw />,
          underline: true,
          onClick: () =>
            navigateBack(-(historyPart.length - 1 - lastResultsIndex)),
        },
        ...list.slice(1),
      ];
    }
    return list;
  }, [navigationHistory]);

  return (
    <div className="w-full bg-bg-shade py-2 pl-8 pr-6 flex items-center justify-between border-b border-bg-border shadow-medium relative z-70">
      <div className="overflow-hidden">
        <Breadcrumbs
          pathParts={breadcrumbs}
          path={''}
          separator="›"
          type="button"
        />
      </div>
      <div className="w-full max-w-[548px] flex-grow-[3]">
        <SearchInput />
      </div>
      <div className="flex-grow flex items-center justify-end max-w-[25%]">
        <BranchSelector />
      </div>
    </div>
  );
};

export default Subheader;
