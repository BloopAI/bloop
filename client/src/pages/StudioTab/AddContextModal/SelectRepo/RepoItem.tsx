import { memo, useCallback, useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import FileIcon from '../../../../components/FileIcon';
import { getFileExtensionForLang } from '../../../../utils';
import LiteLoaderContainer from '../../../../components/Loaders/LiteLoader';
import KeyboardChip from '../../KeyboardChip';
import { RepoType } from '../../../../types/general';

type Props = RepoType & {
  repoRef: string;
  onSubmit: (r: RepoType) => void;
  i: number;
  setHighlightedIndex: (i: number) => void;
  isFocused: boolean;
};

const RepoItem = ({
  onSubmit,
  last_index,
  name,
  repoRef,
  most_common_lang,
  i,
  isFocused,
  setHighlightedIndex,
  ...restRepo
}: Props) => {
  useTranslation();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleSubmit = useCallback(() => {
    if (!last_index || last_index === '1970-01-01T00:00:00Z') {
      return;
    }
    onSubmit({ ...restRepo, ref: repoRef, name, last_index, most_common_lang });
  }, [repoRef, name, last_index, most_common_lang, restRepo]);

  const handleMouseOver = useCallback(() => {
    setHighlightedIndex(i);
  }, []);

  return (
    <button
      type="button"
      ref={ref}
      onClick={handleSubmit}
      onMouseOver={handleMouseOver}
      className={`flex h-9 px-3 gap-3 items-center justify-between group rounded-6 ${
        isFocused ? 'bg-bg-base-hover' : 'bg-bg-shade'
      } hover:bg-bg-base-hover focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0`}
    >
      <div
        className={`body-s ellipsis flex gap-2 items-center ${
          isFocused ? 'text-label-title' : 'text-label-base'
        } group-hover:text-label-title group-focus:text-label-title `}
      >
        <FileIcon filename={getFileExtensionForLang(most_common_lang)} />
        {name}
        {(!last_index || last_index === '1970-01-01T00:00:00Z') && (
          <div className="h-5 px-1 flex items-center gap-1 rounded-sm bg-label-muted/15 caption text-label-base flex-shrink-0 w-fit select-none">
            <LiteLoaderContainer sizeClassName="w-3.5 h-3.5" />
            <Trans>Indexing...</Trans>
          </div>
        )}
      </div>
      <div
        className={`group-hover:opacity-100 group-focus:opacity-100 ${
          isFocused ? 'opacity-100' : 'opacity-0'
        } transition-all flex gap-1.5 items-center caption text-label-base`}
      >
        <Trans>
          {!last_index || last_index === '1970-01-01T00:00:00Z'
            ? 'Unavailable'
            : 'Select'}
        </Trans>
        {last_index && last_index !== '1970-01-01T00:00:00Z' && (
          <KeyboardChip type="cmd" variant="tertiary" />
        )}
        {last_index && last_index !== '1970-01-01T00:00:00Z' && (
          <KeyboardChip type="entr" variant="tertiary" />
        )}
      </div>
    </button>
  );
};

export default memo(RepoItem);
