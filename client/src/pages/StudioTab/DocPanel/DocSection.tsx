import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  MouseEvent,
} from 'react';
import { Trans } from 'react-i18next';
import RenderedSection from '../AddDocsModal/Sections/RenderedSection';
import Button from '../../../components/Button';
import { DocSectionType } from '../../../types/api';

type Props = DocSectionType & {
  isSelected: boolean;
  isNothingSelected: boolean;
  setSelectedSections: Dispatch<SetStateAction<string[]>>;
};

const DocSection = ({
  text,
  isSelected,
  setSelectedSections,
  point_id,
  isNothingSelected,
  doc_source,
}: Props) => {
  const setSelected = useCallback(
    (b: boolean) => {
      setSelectedSections((prev) => {
        if (b) {
          return [...prev, point_id];
        }
        return prev.filter((r) => r !== point_id);
      });
    },
    [point_id, setSelectedSections],
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setSelected(!isSelected);
    },
    [isSelected],
  );
  return (
    <div
      data-section-id={point_id}
      className={`body-s cursor-pointer relative group ${
        isSelected
          ? 'bg-bg-main/8 opacity-100'
          : `hover:bg-bg-base-hover ${
              isNothingSelected ? '' : 'opacity-50 hover:opacity-100'
            }`
      } pl-8 pr-4 py-3 transition-opacity duration-150 ease-in-out flex items-start gap-5`}
      onClick={handleClick}
    >
      <div
        className={`absolute top-2 right-2 z-10 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity duration-150 ease-in-out`}
      >
        <Button size="tiny" variant="secondary" onClick={handleClick}>
          {!isSelected ? (
            <Trans>Select section</Trans>
          ) : (
            <Trans>Clear section</Trans>
          )}
        </Button>
      </div>
      <RenderedSection text={text} baseUrl={doc_source} />
    </div>
  );
};

export default memo(DocSection);
