import React, {
  Dispatch,
  memo,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Dropdown from '../../../../components/Dropdown';
import {
  ArrowTriangleBottomIcon,
  CodeStudioIcon,
  MoreHorizontalIcon,
} from '../../../../icons';
import Button from '../../../../components/Button';
import { ProjectContext } from '../../../../context/projectContext';
import { useNavPanel } from '../../../../hooks/useNavPanel';
import { IndexingStatusType, TabTypesEnum } from '../../../../types/general';
import { TabsContext } from '../../../../context/tabsContext';
import StudioEntry from './StudioEntry';
import StudiosDropdown from './StudiosDropdown';

type Props = {
  setExpanded: Dispatch<SetStateAction<string>>;
  isExpanded: boolean;
  index: string;
  indexingStatus: IndexingStatusType;
};

const reactRoot = document.getElementById('root')!;

const StudiosNav = ({
  isExpanded,
  setExpanded,
  index,
  indexingStatus,
}: Props) => {
  const { t } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState('');
  const { project } = useContext(ProjectContext.Current);
  const { tab: tabLeft } = useContext(TabsContext.CurrentLeft);
  const { tab: tabRight } = useContext(TabsContext.CurrentRight);
  const { focusedPanel } = useContext(TabsContext.FocusedPanel);
  const { noPropagate, itemProps } = useNavPanel(
    index,
    setExpanded,
    isExpanded,
  );

  const previewingSnapshot = useMemo(() => {
    const focusedTab = focusedPanel === 'left' ? tabLeft : tabRight;
    return focusedTab?.type === TabTypesEnum.STUDIO && focusedTab?.snapshot
      ? {
          studioId: focusedTab.studioId,
          snapshot: focusedTab.snapshot,
        }
      : null;
  }, [focusedPanel, tabLeft, tabRight]);

  return (
    <div className="select-none overflow-hidden w-full flex-shrink-0">
      <span {...itemProps}>
        <CodeStudioIcon
          sizeClassName="w-3.5 h-3.5"
          className="text-brand-studio"
        />
        <p className="flex items-center gap-1 body-s-b flex-1 ellipsis">
          <span className="text-label-title ellipsis">
            <Trans>Studio conversations</Trans>
          </span>
          {isExpanded && (
            <ArrowTriangleBottomIcon
              sizeClassName="w-2 h-2"
              className="text-label-muted"
            />
          )}
        </p>
        {isExpanded && (
          <div onClick={noPropagate}>
            <Dropdown
              DropdownComponent={StudiosDropdown}
              appendTo={reactRoot}
              dropdownPlacement="bottom-start"
              size="auto"
            >
              <Button
                variant="tertiary"
                size="mini"
                onlyIcon
                title={t('More actions')}
              >
                <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
              </Button>
            </Dropdown>
          </div>
        )}
      </span>
      {isExpanded && (
        <div className={'overflow-hidden'}>
          {project?.studios.map((c) => (
            <StudioEntry
              key={c.id}
              {...c}
              index={`${index}-${c.id}`}
              expandedIndex={expandedIndex}
              setExpandedIndex={setExpandedIndex}
              indexingStatus={indexingStatus}
              projectId={project.id}
              previewingSnapshot={
                previewingSnapshot?.studioId.toString() === c.id.toString()
                  ? previewingSnapshot.snapshot
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(StudiosNav);
