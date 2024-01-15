import { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import FileChip from '../../../../components/Chips/FileChip';
import { ChatLoadingStep, TabTypesEnum } from '../../../../types/general';
import { TabsContext } from '../../../../context/tabsContext';

type Props = ChatLoadingStep & {
  side: 'left' | 'right';
  repo?: string;
};

const LoadingStep = ({ type, path, displayText, side, repo }: Props) => {
  const { t } = useTranslation();
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleClickFile = useCallback(() => {
    if (type === 'proc' && repo && path) {
      openNewTab(
        {
          type: TabTypesEnum.FILE,
          repoRef: repo,
          path,
        },
        side === 'left' ? 'right' : 'left',
      );
    }
  }, [path, repo, side]);

  return (
    <div className="flex gap-2 body-s text-label-base items-center">
      <span>{type === 'proc' ? t('Reading ') : displayText}</span>
      {type === 'proc' ? (
        <FileChip
          onClick={handleClickFile}
          fileName={path.split('/').pop() || ''}
          filePath={path || ''}
        />
      ) : null}
    </div>
  );
};

export default memo(LoadingStep);
