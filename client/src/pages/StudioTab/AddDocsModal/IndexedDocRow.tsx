import { memo } from 'react';
import { Trans } from 'react-i18next';
import KeyboardChip from '../KeyboardChip';
import { DocShortType } from '../../../types/api';

type Props = {
  doc: DocShortType;
  onSubmit: (doc: DocShortType) => void;
};

const IndexedDocRow = ({ onSubmit, doc }: Props) => {
  return (
    <button
      type="button"
      onClick={() => onSubmit(doc)}
      className="flex h-9 px-3 gap-3 items-center justify-between group rounded-6 bg-bg-shade hover:bg-bg-base-hover focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0"
    >
      <div className="body-s text-label-base group-hover:text-label-title group-focus:text-label-title ellipsis flex gap-2 items-center">
        <div className="w-5 h-5">
          <img src={doc.favicon} alt={doc.name} />
        </div>
        {doc.name}
      </div>
      <div className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all flex gap-1.5 items-center caption text-label-base">
        <Trans>Select</Trans>
        <KeyboardChip type="entr" variant="tertiary" />
      </div>
    </button>
  );
};

export default memo(IndexedDocRow);
