import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  StudioLeftPanelDataType,
  StudioLeftPanelType,
} from '../../../types/general';
import Button from '../../../components/Button';
import KeyboardChip from '../KeyboardChip';
import { DocsSection, Magazine } from '../../../icons';
import TokensUsageBadge from '../TokensUsageBadge';
import { getDocSections } from '../../../services/api';
import { DocSectionType } from '../../../types/api';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import SectionsBadge from './SectionsBadge';
import DocSection from './DocSection';

type Props = {
  isActiveTab: boolean;
  isDocInContext: boolean;
  initialSections?: string[];
  selectedSection?: string;
  setLeftPanel: Dispatch<SetStateAction<StudioLeftPanelDataType>>;
  id: string;
  name: string;
  url: string;
  baseUrl: string;
  onSectionsChanged: (
    selectedSections: string[],
    id: string,
    name: string,
  ) => void;
};

const DocPanel = ({
  id,
  setLeftPanel,
  baseUrl,
  url,
  name,
  isActiveTab,
  isDocInContext,
  initialSections,
  onSectionsChanged,
  selectedSection,
}: Props) => {
  useTranslation();
  const [selectedSections, setSelectedSections] = useState(
    initialSections || [],
  );
  const [tokenCount, setTokenCount] = useState(0);
  const [sections, setSections] = useState<DocSectionType[]>([]);

  useEffect(() => {
    if (isActiveTab) {
      getDocSections(id, url).then((resp) => {
        setSections(resp);
      });
    }
  }, [isActiveTab, id, url]);

  useEffect(() => {
    if (selectedSection && sections.length) {
      setSelectedSections((prev) => [...prev, selectedSection]);
      findElementInCurrentTab(
        `[data-section-id="${selectedSection}"]`,
      )?.scrollIntoView();
    }
  }, [selectedSection, sections.length]);

  const onCancel = useCallback(() => {
    setLeftPanel({ type: StudioLeftPanelType.CONTEXT });
  }, [setLeftPanel]);

  const onSubmit = useCallback(() => {
    onSectionsChanged(selectedSections, id, name);
    setLeftPanel({ type: StudioLeftPanelType.CONTEXT });
  }, [onSectionsChanged, selectedSections, id, name, setLeftPanel]);

  return (
    <div className="flex flex-col w-full flex-1 overflow-auto relative">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-auto">
          <div className="flex items-center p-1 rounded border border-bg-border bg-bg-base">
            <Magazine raw sizeClassName="w-4 h-4" />
          </div>
          <p className="body-s-strong text-label-title ellipsis">{name}</p>
          <SectionsBadge sections={selectedSections} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button size="small" variant="secondary" onClick={onCancel}>
            {!isDocInContext ||
            JSON.stringify(initialSections) !==
              JSON.stringify(selectedSections) ? (
              <Trans>Cancel</Trans>
            ) : (
              <Trans>Back</Trans>
            )}
          </Button>
          {(!isDocInContext ||
            JSON.stringify(initialSections) !==
              JSON.stringify(selectedSections)) && (
            <Button size="small" onClick={onSubmit}>
              <Trans>Save</Trans>
              <div className="flex items-center gap-1 flex-shrink-0">
                <KeyboardChip type="cmd" variant="primary" />
                <KeyboardChip type="S" variant="primary" />
              </div>
            </Button>
          )}
        </div>
      </div>
      <div className="flex px-8 py-2 items-center justify-between gap-2 border-b border-bg-border bg-bg-sub text-label-base overflow-x-auto flex-shrink-0">
        <div className="flex items-center gap-1.5 caption text-label-link ellipsis">
          <p>
            {baseUrl}
            {url}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TokensUsageBadge tokens={tokenCount} />
        </div>
      </div>
      <div className={`overflow-auto flex flex-col`}>
        {sections.map((s) => {
          return (
            <DocSection
              key={s.point_id}
              {...s}
              isSelected={selectedSections.includes(s.point_id)}
              setSelectedSections={setSelectedSections}
            />
          );
        })}
      </div>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-full flex h-8 items-center gap-2 p-2 pr-2.5 border border-bg-border bg-bg-base shadow-float caption text-label-title flex-shrink-0 w-fit z-20">
        <DocsSection />
        <p className="pointer-events-none select-none cursor-default">
          <Trans>Only the selected sections will be used as context.</Trans>
        </p>
        {!!selectedSections.length && (
          <Button
            variant="tertiary"
            size="tiny"
            onClick={() => setSelectedSections([])}
          >
            <Trans>Clear sections</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(DocPanel);
