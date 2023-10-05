import React, { Dispatch, memo, SetStateAction } from 'react';
import Checkbox from '../../../components/Checkbox';
import RenderedSection from '../AddDocsModal/RenderedSection';

type Props = {
  text: string;
  point_id: string;
  isSelected: boolean;
  setSelected: Dispatch<SetStateAction<boolean>>;
};

const DocSection = ({ text, isSelected, setSelected, point_id }: Props) => {
  return (
    <div
      data-section-id={point_id}
      className={`body-s ${
        isSelected
          ? 'bg-bg-main/15 opacity-100'
          : 'opacity-50 hover:opacity-100'
      } pl-8 pr-4 py-3 transition-opacity duration-150 ease-in-out flex items-start gap-5`}
    >
      <Checkbox
        checked={isSelected}
        label={<RenderedSection text={text} />}
        isBoxAtTop
        boxClassName="relative top-1"
        onChange={setSelected}
      />
    </div>
  );
};

export default memo(DocSection);
