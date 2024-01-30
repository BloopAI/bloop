import React, { Dispatch, memo, SetStateAction, useCallback } from 'react';
import { Trans } from 'react-i18next';
import Button from '../../../components/Button';
import { DocSectionType } from '../../../types/api';
import RenderedSection from './RenderedSection';

type Props = DocSectionType & {
  isSelected: boolean;
  isNothingSelected: boolean;
  isEditingSelection: boolean;
  setSelectedSections: Dispatch<SetStateAction<string[]>>;
};

const DocSection = ({
  text,
  isSelected,
  setSelectedSections,
  point_id,
  isNothingSelected,
  doc_source,
  isEditingSelection,
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

  const handleClick = useCallback(() => {
    if (isEditingSelection) {
      setSelected(!isSelected);
    }
  }, [isSelected, isEditingSelection]);
  return (
    <div
      data-section-id={point_id}
      className={`body-s relative group ${
        isSelected
          ? 'bg-bg-selected opacity-100'
          : isEditingSelection
          ? `hover:bg-bg-sub-hover ${
              isNothingSelected ? '' : 'opacity-50 hover:opacity-100'
            }`
          : ''
      } ${
        isEditingSelection ? 'cursor-pointer' : ''
      } pl-8 pr-4 py-3 transition-opacity duration-150 ease-in-out`}
      onClick={handleClick}
    >
      {isEditingSelection && (
        <div
          className={`absolute top-2 right-2 z-10 ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition-opacity duration-150 ease-in-out`}
        >
          <Button size="mini" variant="secondary" onClick={handleClick}>
            {!isSelected ? (
              <Trans>Select section</Trans>
            ) : (
              <Trans>Clear section</Trans>
            )}
          </Button>
        </div>
      )}
      <RenderedSection
        text={text}
        baseUrl={doc_source}
        isEditingSelection={isEditingSelection}
      />
    </div>
  );
};

export default memo(DocSection);
