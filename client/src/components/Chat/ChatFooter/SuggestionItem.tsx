import { memo, useCallback, useEffect, useRef } from 'react';
import { FolderFilled } from '../../../icons';
import FileIcon from '../../FileIcon';
import { getFileExtensionForLang } from '../../../utils';

type Props = {
  isFocused: boolean;
  kind: string;
  text: string;
  type: string;
  onClick: (o: { type: string; text: string }) => void;
  setHighlightedIndex: (i: number) => void;
  i: number;
};

const SuggestionItem = ({
  isFocused,
  text,
  kind,
  type,
  onClick,
  setHighlightedIndex,
  i,
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleMouseOver = useCallback(() => {
    setHighlightedIndex(i);
  }, [i]);

  const handleClick = useCallback(() => {
    onClick({ type, text });
  }, [onClick, text, type]);
  return (
    <button
      type="button"
      className={`flex items-center justify-start rounded-6 gap-2 px-2 py-1 ${
        isFocused ? 'bg-chat-bg-base-hover' : ''
      } body-s text-label-title`}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      ref={ref}
    >
      {kind === 'dirOptions' ? (
        <FolderFilled />
      ) : (
        <FileIcon
          filename={
            kind === 'langOptions' ? getFileExtensionForLang(text, true) : text
          }
        />
      )}
      {text}
    </button>
  );
};

export default memo(SuggestionItem);
