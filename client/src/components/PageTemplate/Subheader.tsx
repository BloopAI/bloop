import React, { useContext, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SearchInput from '../SearchInput';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { splitPath } from '../../utils';
import Button from '../Button';
import {
  ArrowJumpLeft,
  ArrowLeft,
  ArrowRight,
  Clock,
  CodeIcon,
  Def,
  FolderFilled,
  Ref,
  RegexIcon,
} from '../../icons';
import FileIcon from '../FileIcon';
import { DropdownWithIcon } from '../Dropdown';
import { ContextMenuItem } from '../ContextMenu';
import { MenuItemType } from '../../types/general';
import BranchSelector from './BranchSelector';
import RepoHomeBtn from './RepoHomeBtn';
import Separator from './Separator';

const Subheader = () => {
  const { t } = useTranslation();
  const {
    navigationHistory,
    navigateBack,
    navigateForward,
    forwardNavigation,
  } = useContext(AppNavigationContext);

  const resultsBackIndex = useMemo(() => {
    const index = navigationHistory.findLastIndex(
      (item) =>
        item.type === 'conversation-result' || item.type === 'article-response',
    );
    if (index < 0) {
      return 0;
    }
    return -(navigationHistory.length - 1 - index);
  }, [navigationHistory]);

  const breadcrumbs = useMemo(() => {
    const reversedHistory = [...navigationHistory].reverse();
    const lastHomeIndex = reversedHistory.findIndex(
      (n) => n.type === 'repo' && !n.path,
    );
    let historyPart = navigationHistory.slice(1);
    if (lastHomeIndex >= 0) {
      historyPart = reversedHistory.slice(0, lastHomeIndex).reverse();
    }
    let resultsInList: boolean;
    let pathToFileInList: boolean;
    let list: ContextMenuItem[] = historyPart
      .map((item, i): (ContextMenuItem & { navType: string }) | undefined => {
        const onClick = () => navigateBack(-(historyPart.length - 1 - i));
        if (item.type === 'repo' && !item.path) {
          return {
            text: item.repo!,
            type: MenuItemType.DEFAULT,
            onClick,
            navType: 'repo',
          };
        }
        if (
          (item.type === 'repo' || item.type === 'full-result') &&
          item.path
        ) {
          const label = splitPath(item.path);
          return {
            text: (
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
            type: MenuItemType.DEFAULT,
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
            navType: item.pathParams?.type || '',
          };
        }
        if (
          item.type === 'conversation-result' ||
          item.type === 'article-response'
        ) {
          return {
            text: 'Results',
            type: MenuItemType.DEFAULT,
            icon:
              i !== historyPart.length - 1 ? (
                <CodeIcon sizeClassName="w-4 h-4" raw />
              ) : undefined,
            onClick,
            navType: 'results',
          };
        }
        if (historyPart[i - 1]?.query !== item.query) {
          return {
            text: item.query || 'Regex search',
            type: MenuItemType.DEFAULT,
            icon: <RegexIcon sizeClassName="w-3 h-3" raw />,
            onClick,
            navType: 'search',
          };
        }
      })
      .reverse()
      .filter((i, index, array): i is ContextMenuItem & { navType: string } => {
        if (i?.navType === 'results') {
          if (resultsInList) {
            return false; // remove clusters of Results
          }
          resultsInList = true;
        } else {
          resultsInList = false;
        }
        if (i?.navType !== 'results' && i?.navType !== 'search') {
          // is part of path to file and not ref/def and not before ref/def
          if (pathToFileInList && !i?.navType && !array[index - 1]?.navType) {
            return false; // remove clusters of navigation items
          }
          pathToFileInList = true;
        } else {
          pathToFileInList = false;
        }
        return !!i;
      })
      .reverse();
    return list;
  }, [navigationHistory]);

  return (
    <div className="w-full bg-bg-shade py-2 px-6 flex items-center justify-between border-b border-bg-border shadow-medium relative z-70">
      <div className="flex items-center">
        <RepoHomeBtn />
        <Separator />
        <div className="flex gap-1 items-center">
          <Button
            onlyIcon
            title={t('Go back')}
            onClick={() => navigateBack('auto')}
            disabled={!navigationHistory.length}
            variant="tertiary"
            size="tiny"
          >
            <ArrowLeft />
          </Button>
          <Button
            onlyIcon
            title={t('Go forward')}
            onClick={() => navigateForward('auto')}
            disabled={!forwardNavigation.length}
            variant="tertiary"
            size="tiny"
          >
            <ArrowRight />
          </Button>
          <DropdownWithIcon
            items={breadcrumbs}
            icon={<Clock />}
            btnOnlyIcon
            btnVariant="tertiary"
            btnSize="tiny"
            noChevron
            disabled={!breadcrumbs.length}
            btnTitle={t('History')}
          />
        </div>
        {resultsBackIndex ? (
          <>
            <Separator />
            <div className="flex flex-grow flex-col gap-3 justify-center overflow-hidden">
              <Button
                variant="tertiary"
                size="tiny"
                onClick={() => navigateBack(resultsBackIndex)}
              >
                <ArrowJumpLeft raw sizeClassName="w-3.5 h-3.5" />
                <Trans>Results</Trans>
              </Button>
            </div>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-64">
          <SearchInput />
        </div>
        <BranchSelector />
      </div>
    </div>
  );
};

export default Subheader;
