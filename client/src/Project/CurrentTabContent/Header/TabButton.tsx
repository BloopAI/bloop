import { memo, useCallback, useContext, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileTabType } from '../../../types/general';
import FileIcon from '../../../components/FileIcon';
import { splitPath } from '../../../utils';
import Button from '../../../components/Button';
import { CloseSignIcon } from '../../../icons';
import { TabsContext } from '../../../context/tabsContext';

type Props = FileTabType & {
  tabKey: string;
  isActive: boolean;
};

const TabButton = ({ isActive, tabKey, repoName, path }: Props) => {
  const { t } = useTranslation();
  const { closeTab, setActiveTab } = useContext(TabsContext.Handlers);

  const handleClose = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      closeTab(tabKey);
    },
    [tabKey],
  );

  const handleClick = useCallback(() => {
    setActiveTab({ path, repoName, key: tabKey });
  }, [path, repoName, tabKey]);

  return (
    <a
      href="#"
      onClick={handleClick}
      className={`flex h-7 max-w-[9rem] gap-1.5 pl-2 pr-1.5 flex-shrink-0 items-center rounded ellipsis group ${
        isActive ? 'bg-bg-base-hover' : ''
      } hover:bg-bg-base-hover transition duration-75 ease-in-out select-none`}
    >
      <FileIcon filename={path} noMargin />
      <p
        className={`body-mini-b ellipsis group-hover:text-label-title flex-1 ${
          isActive ? 'text-label-title' : 'text-label-muted'
        } transition duration-75 ease-in-out`}
      >
        {splitPath(path).pop()}
      </p>
      <Button
        variant="ghost"
        size="mini"
        onlyIcon
        title={t('Close')}
        className={`opacity-0 group-hover:opacity-100 ${
          isActive ? 'opacity-100' : ''
        }`}
        onClick={handleClose}
      >
        <CloseSignIcon sizeClassName={'w-3 h-3'} />
      </Button>
    </a>
  );
};

export default memo(TabButton);
