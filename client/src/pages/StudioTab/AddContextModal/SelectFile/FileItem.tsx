import { memo, useCallback, useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import KeyboardChip from '../../KeyboardChip';
import FileIcon from '../../../../components/FileIcon';

type Props = {
  filename: string;
  onSubmit: (b: string) => void;
  i: number;
  setHighlightedIndex: (i: number) => void;
  isFocused: boolean;
};

const FileItem = ({
  filename,
  setHighlightedIndex,
  onSubmit,
  isFocused,
  i,
}: Props) => {
  useTranslation();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleMouseOver = useCallback(() => {
    setHighlightedIndex(i);
  }, []);

  return (
    <button
      type="button"
      onClick={() => onSubmit(filename)}
      ref={ref}
      onMouseOver={handleMouseOver}
      className={`flex h-9 px-3 gap-3 items-center justify-between group rounded-6 cursor-pointer body-s ellipsis ${
        isFocused ? 'bg-bg-base-hover' : 'bg-bg-shade'
      } hover:bg-bg-base-hover focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full flex-shrink-0`}
    >
      <div
        className={`body-s ellipsis flex gap-2 items-center ${
          isFocused ? 'text-label-title' : 'text-label-base'
        } group-hover:text-label-title group-focus:text-label-title`}
      >
        <FileIcon filename={filename} />
        {filename}
      </div>
      <div
        className={`group-hover:opacity-100 group-focus:opacity-100 ${
          isFocused ? 'opacity-100' : 'opacity-0'
        } transition-all flex gap-1.5 items-center caption text-label-base`}
      >
        <Trans>Select</Trans>
        <KeyboardChip type="cmd" variant="tertiary" />
        <KeyboardChip type="entr" variant="tertiary" />
      </div>
    </button>
  );
};

export default memo(FileItem);
