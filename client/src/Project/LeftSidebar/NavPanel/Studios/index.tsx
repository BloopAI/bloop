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
import {
  DocTabType,
  FileTabType,
  IndexingStatusType,
  StudioTabType,
  TabTypesEnum,
} from '../../../../types/general';
import StudioEntry from './StudioEntry';
import StudiosDropdown from './StudiosDropdown';

type Props = {
  setExpanded: Dispatch<SetStateAction<string>>;
  isExpanded: boolean;
  index: string;
  indexingStatus: IndexingStatusType;
  currentlyFocusedTab?: StudioTabType | FileTabType | DocTabType;
};

const reactRoot = document.getElementById('root')!;

const StudiosNav = ({
  isExpanded,
  setExpanded,
  index,
  indexingStatus,
  currentlyFocusedTab,
}: Props) => {
  const { t } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState('');
  const { project } = useContext(ProjectContext.Current);
  const { noPropagate, itemProps } = useNavPanel(
    index,
    setExpanded,
    isExpanded,
  );

  const previewingSnapshot = useMemo(() => {
    return currentlyFocusedTab?.type === TabTypesEnum.STUDIO &&
      currentlyFocusedTab?.snapshot
      ? {
          studioId: currentlyFocusedTab.studioId,
          snapshot: currentlyFocusedTab.snapshot,
        }
      : null;
  }, [currentlyFocusedTab]);

  const currentPath = useMemo(() => {
    return currentlyFocusedTab?.type === TabTypesEnum.FILE &&
      currentlyFocusedTab.studioId
      ? {
          studioId: currentlyFocusedTab.studioId,
          path: currentlyFocusedTab.path,
          repoRef: currentlyFocusedTab.repoRef,
        }
      : undefined;
  }, [currentlyFocusedTab]);

  const currentDoc = useMemo(() => {
    return currentlyFocusedTab?.type === TabTypesEnum.DOC &&
      currentlyFocusedTab.studioId
      ? {
          studioId: currentlyFocusedTab.studioId,
          docId: currentlyFocusedTab.docId,
          relativeUrl: currentlyFocusedTab.relativeUrl,
        }
      : undefined;
  }, [currentlyFocusedTab]);

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
              currentPath={
                currentPath?.studioId.toString() === c.id.toString()
                  ? currentPath
                  : undefined
              }
              currentDoc={
                currentDoc?.studioId.toString() === c.id.toString()
                  ? currentDoc
                  : undefined
              }
              isViewingPrompts={
                currentlyFocusedTab?.type === TabTypesEnum.STUDIO &&
                currentlyFocusedTab.studioId.toString() === c.id.toString() &&
                !currentlyFocusedTab.snapshot
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(StudiosNav);
