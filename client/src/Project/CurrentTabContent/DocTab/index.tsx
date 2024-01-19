import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CommandBarStepEnum, DocTabType } from '../../../types/general';
import {
  MagazineIcon,
  MoreHorizontalIcon,
  SplitViewIcon,
  StudioCloseSignIcon,
  StudioPlusSignIcon,
} from '../../../icons';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { TabsContext } from '../../../context/tabsContext';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { UIContext } from '../../../context/uiContext';
import { CommandBarContext } from '../../../context/commandBarContext';
import {
  addToStudioShortcut,
  openInSplitViewShortcut,
  removeFromStudioShortcut,
} from '../../../consts/shortcuts';
import {
  getCodeStudio,
  getDocSections,
  getDocTokenCount,
  getIndexedPages,
  patchCodeStudio,
} from '../../../services/api';
import {
  CodeStudioType,
  DocPageType,
  DocSectionType,
} from '../../../types/api';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { ProjectContext } from '../../../context/projectContext';
import Badge from '../../../components/Badge';
import { humanNumber } from '../../../utils';
import ActionsDropdown from './ActionsDropdown';
import DocSection from './DocSection';

type Props = DocTabType & {
  noBorder?: boolean;
  side: 'left' | 'right';
  tabKey: string;
  handleMoveToAnotherSide: () => void;
};

const DocTab = ({
  side,
  tabKey,
  handleMoveToAnotherSide,
  docId,
  title,
  favicon,
  noBorder,
  relativeUrl,
  studioId,
  initialSections,
  isDocInContext,
}: Props) => {
  const { t } = useTranslation();
  const { focusedPanel } = useContext(TabsContext.All);
  const { updateTabProperty } = useContext(TabsContext.Handlers);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { setFocusedTabItems, setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { isVisible: isCommandBarVisible } = useContext(
    CommandBarContext.General,
  );
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );
  const [fullDoc, setFullDoc] = useState<DocPageType | null>(null);
  const [studio, setStudio] = useState<CodeStudioType | null>(null);
  const [sections, setSections] = useState<DocSectionType[]>([]);
  const [selectedSections, setSelectedSections] = useState(
    initialSections || [],
  );
  const [tokenCount, setTokenCount] = useState(0);
  const [isEditingSelection, setIsEditingSelection] = useState(false);

  const refreshStudio = useCallback(() => {
    if (studioId && project?.id) {
      getCodeStudio(project.id, studioId).then(setStudio);
    } else {
      setStudio(null);
    }
  }, [studioId, project?.id]);

  useEffect(() => {
    refreshStudio();
  }, [refreshStudio]);

  useEffect(() => {
    getIndexedPages(docId).then((resp) => {
      const doc = resp.find((p) => p.relative_url === relativeUrl);
      if (doc) {
        setFullDoc(doc);
      }
    });
    getDocSections(docId, relativeUrl).then((resp) => {
      setSections(resp);
    });
  }, [docId, relativeUrl]);

  useEffect(() => {
    if (project?.id) {
      getDocTokenCount(project.id, docId, relativeUrl, selectedSections).then(
        setTokenCount,
      );
    }
  }, [selectedSections, relativeUrl, docId, project?.id]);

  useEffect(() => {
    if (initialSections?.length && sections.length) {
      const firstSelectedSection =
        initialSections?.length === 1
          ? initialSections[0]
          : initialSections?.length
          ? sections.find((s) => initialSections?.includes(s.point_id))
              ?.point_id
          : '';
      findElementInCurrentTab(
        `[data-active="true"][data-section-id="${firstSelectedSection}"]`,
      )?.scrollIntoView();
    }
  }, [sections.length, initialSections]);

  const handleAddToStudio = useCallback(() => {
    setChosenStep({
      id: CommandBarStepEnum.ADD_TO_STUDIO,
      data: { docId, relativeUrl, favicon, title },
    });
    setIsVisible(true);
  }, [docId, relativeUrl, favicon, title]);

  const handleRemoveFromStudio = useCallback(async () => {
    if (project?.id && studioId && studio) {
      const patchedDoc = studio?.doc_context.find(
        (d) => d.doc_id === docId && d.relative_url === relativeUrl,
      );
      if (patchedDoc) {
        await patchCodeStudio(project.id, studioId, {
          doc_context: studio?.doc_context.filter(
            (d) => d.doc_id !== docId || d.relative_url !== relativeUrl,
          ),
        });
        refreshCurrentProjectStudios();
        refreshStudio();
        setIsEditingSelection(false);
        updateTabProperty<DocTabType, 'isDocInContext'>(
          tabKey,
          'isDocInContext',
          false,
          side,
        );
        updateTabProperty<DocTabType, 'initialSections'>(
          tabKey,
          'initialSections',
          undefined,
          side,
        );
        updateTabProperty<DocTabType, 'studioId'>(
          tabKey,
          'studioId',
          undefined,
          side,
        );
        setStudio(null);
        setSelectedSections([]);
      }
    }
  }, [docId, relativeUrl, project?.id, studioId, studio]);

  const dropdownComponentProps = useMemo(() => {
    return {
      handleMoveToAnotherSide,
      handleAddToStudio,
      handleRemoveFromStudio,
      isDocInContext,
    };
  }, [
    handleMoveToAnotherSide,
    handleAddToStudio,
    handleRemoveFromStudio,
    isDocInContext,
  ]);

  useEffect(() => {
    if (focusedPanel === side) {
      setFocusedTabItems([
        {
          label: t('Open in split view'),
          Icon: SplitViewIcon,
          id: 'split_view',
          key: 'split_view',
          onClick: handleMoveToAnotherSide,
          closeOnClick: true,
          shortcut: openInSplitViewShortcut,
          footerHint: '',
          footerBtns: [{ label: t('Move'), shortcut: ['entr'] }],
        },
        ...(studioId
          ? [
              {
                label: t('Remove from studio'),
                Icon: StudioCloseSignIcon,
                id: 'doc_from_studio',
                key: 'doc_from_studio',
                onClick: handleRemoveFromStudio,
                shortcut: removeFromStudioShortcut,
                footerHint: t('Remove page from code studio context'),
                footerBtns: [{ label: t('Remove'), shortcut: ['entr'] }],
              },
            ]
          : [
              {
                label: t('Add to studio'),
                Icon: StudioPlusSignIcon,
                id: 'doc_to_studio',
                key: 'doc_to_studio',
                onClick: handleAddToStudio,
                shortcut: addToStudioShortcut,
                footerHint: t('Add file to code studio context'),
                footerBtns: [{ label: t('Add'), shortcut: ['entr'] }],
              },
            ]),
      ]);
    }
  }, [
    focusedPanel,
    side,
    handleMoveToAnotherSide,
    handleRemoveFromStudio,
    handleAddToStudio,
  ]);

  const hasChanges = useMemo(() => {
    return (
      (studioId && !isDocInContext) ||
      JSON.stringify(initialSections) !== JSON.stringify(selectedSections)
    );
  }, [studioId, isDocInContext, initialSections, selectedSections]);

  const handleEditRanges = useCallback(() => {
    setIsEditingSelection(true);
  }, []);

  useEffect(() => {
    if (studioId && !isDocInContext) {
      handleEditRanges();
    }
  }, [studioId, isDocInContext, handleEditRanges]);

  const handleCancelStudio = useCallback(() => {
    setIsEditingSelection(false);
    if (isDocInContext) {
      setSelectedSections(initialSections || []);
    } else {
      setSelectedSections([]);
      updateTabProperty<DocTabType, 'studioId'>(
        tabKey,
        'studioId',
        undefined,
        side,
      );
    }
  }, [tabKey, side, isDocInContext, initialSections]);

  const handleSubmitToStudio = useCallback(async () => {
    if (project?.id && studioId && studio) {
      const patchedDoc = studio?.doc_context.find(
        (f) =>
          f.doc_id === docId &&
          f.doc_source === fullDoc?.doc_source &&
          f.relative_url === relativeUrl,
      );
      if (!patchedDoc) {
        await patchCodeStudio(project.id, studioId, {
          doc_context: [
            ...(studio?.doc_context || []),
            {
              doc_id: docId,
              doc_source: fullDoc?.doc_source || '',
              doc_icon: favicon || '',
              doc_title: title || '',
              relative_url: relativeUrl,
              absolute_url: fullDoc?.absolute_url || '',
              ranges: selectedSections,
              hidden: false,
            },
          ],
        });
      } else {
        patchedDoc.ranges = selectedSections;
        const newContext = studio?.doc_context
          .filter(
            (f) =>
              f.doc_id !== docId ||
              f.doc_source !== fullDoc?.doc_source ||
              f.relative_url !== relativeUrl,
          )
          .concat(patchedDoc);
        await patchCodeStudio(project.id, studioId, {
          doc_context: newContext,
        });
      }
      refreshCurrentProjectStudios();
      refreshStudio();
      setIsEditingSelection(false);
      updateTabProperty<DocTabType, 'isDocInContext'>(
        tabKey,
        'isDocInContext',
        true,
        side,
      );
      updateTabProperty<DocTabType, 'initialSections'>(
        tabKey,
        'initialSections',
        selectedSections,
        side,
      );
    }
  }, [
    project?.id,
    studio,
    docId,
    relativeUrl,
    fullDoc,
    studioId,
    selectedSections,
  ]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, openInSplitViewShortcut)) {
        handleMoveToAnotherSide();
      } else if (checkEventKeys(e, addToStudioShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        handleAddToStudio();
      } else if (checkEventKeys(e, removeFromStudioShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        handleRemoveFromStudio();
      }
    },
    [handleMoveToAnotherSide, handleAddToStudio],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    focusedPanel !== side || isLeftSidebarFocused || isCommandBarVisible,
  );

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      <div className="w-full h-10 px-4 flex justify-between gap-1 items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          {favicon ? (
            <img src={favicon} alt={relativeUrl} className="w-4 h-4" />
          ) : (
            <MagazineIcon sizeClassName="w-4 h-4" />
          )}
          <span className="ellipsis">{title || relativeUrl}</span>
          {!!studio && studioId && (
            <>
              <div className="w-px h-4 bg-bg-border flex-shrink-0" />
              <Badge text={t('Whole page')} type="blue-subtle" size="small" />
              <p
                className={`select-none ${
                  tokenCount < 18000 && tokenCount > 1500
                    ? 'text-yellow'
                    : tokenCount < 500
                    ? 'text-green'
                    : 'text-red'
                } code-mini`}
              >
                {humanNumber(tokenCount)}{' '}
                <Trans count={tokenCount}># tokens</Trans>
              </p>
            </>
          )}
        </div>
        {focusedPanel === side &&
          (studioId && (hasChanges || isEditingSelection) ? (
            <div className="flex items-center gap-3">
              {!isEditingSelection && (
                <>
                  <Button
                    variant="secondary"
                    size="mini"
                    onClick={handleEditRanges}
                  >
                    <Trans>Select sections</Trans>
                  </Button>
                  <div className="w-px h-4 bg-bg-border flex-shrink-0" />
                </>
              )}
              <Button
                variant="tertiary"
                size="mini"
                onClick={handleCancelStudio}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant={isDocInContext ? 'secondary' : 'studio'}
                size="mini"
                onClick={handleSubmitToStudio}
              >
                <Trans>{isDocInContext ? 'Save changes' : 'Submit'}</Trans>
              </Button>
            </div>
          ) : (
            studioId && (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="mini"
                  onClick={handleEditRanges}
                >
                  <Trans>Edit sections</Trans>
                </Button>
              </div>
            )
          ))}
        {!isEditingSelection && (
          <Dropdown
            DropdownComponent={ActionsDropdown}
            dropdownComponentProps={dropdownComponentProps}
            appendTo={document.body}
            dropdownPlacement="bottom-end"
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
        )}
      </div>
      <div
        className="flex-1 flex flex-col max-w-full overflow-auto"
        data-active={(focusedPanel === side).toString()}
      >
        {sections.map((s) => {
          return (
            <DocSection
              key={s.point_id}
              {...s}
              isSelected={selectedSections.includes(s.point_id)}
              setSelectedSections={setSelectedSections}
              isNothingSelected={!selectedSections.length}
              isEditingSelection={isEditingSelection}
            />
          );
        })}
      </div>
    </div>
  );
};

export default memo(DocTab);
