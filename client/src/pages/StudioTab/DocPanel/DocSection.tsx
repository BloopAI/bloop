import React, { Dispatch, memo, SetStateAction, useCallback } from 'react';
import Checkbox from '../../../components/Checkbox';
import RenderedSection from '../AddDocsModal/Sections/RenderedSection';

type Props = {
  text: string;
  point_id: string;
  isSelected: boolean;
  setSelectedSections: Dispatch<SetStateAction<string[]>>;
};

const DocSection = ({
  text,
  isSelected,
  setSelectedSections,
  point_id,
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
  return (
    <div
      data-section-id={point_id}
      className={`body-s cursor-pointer ${
        isSelected
          ? 'bg-bg-main/15 opacity-100'
          : 'opacity-50 hover:opacity-100'
      } pl-8 pr-4 py-3 transition-opacity duration-150 ease-in-out flex items-start gap-5`}
      onClick={() => setSelected(!isSelected)}
    >
      <RenderedSection text={text} />
    </div>
  );
};

export default memo(DocSection);
