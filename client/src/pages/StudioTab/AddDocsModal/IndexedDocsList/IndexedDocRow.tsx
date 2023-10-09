import { memo, useCallback, MouseEvent, useRef, useEffect } from 'react';
import { Trans } from 'react-i18next';
import { DocShortType } from '../../../../types/api';
import { Magazine } from '../../../../icons';
import Button from '../../../../components/Button';
import { deleteDocProvider } from '../../../../services/api';

type Props = {
  doc: DocShortType;
  onSubmit: (doc: DocShortType) => void;
  refetchDocs: () => void;
  isFocused: boolean;
  syncDocProvider: (id: string, isResync: boolean) => void;
  i: number;
  setHighlightedIndex: (i: number) => void;
};

const IndexedDocRow = ({
  onSubmit,
  doc,
  refetchDocs,
  isFocused,
  syncDocProvider,
  i,
  setHighlightedIndex,
}: Props) => {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      deleteDocProvider(doc.id).then(() => {
        refetchDocs();
      });
    },
    [doc.id],
  );

  const handleResync = useCallback(() => {
    syncDocProvider(doc.id, true);
  }, [doc.id]);

  const handleMouseOver = useCallback(() => {
    setHighlightedIndex(i);
  }, [i]);

  return (
    <a
      href="#"
      role="button"
      ref={ref}
      onClick={() => onSubmit(doc)}
      className={`flex h-9 px-3 gap-3 items-center justify-between group rounded-6  hover:bg-bg-base-hover ${
        isFocused ? 'bg-bg-base-hover' : 'bg-bg-shade'
      } focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0`}
      onMouseOver={handleMouseOver}
    >
      <div
        className={`body-s group-hover:text-label-title group-focus:text-label-title ${
          isFocused ? 'text-label-title' : 'text-label-base'
        }  ellipsis flex gap-2 items-center`}
      >
        <div className="w-5 h-5">
          {doc.favicon ? (
            <img src={doc.favicon} alt={doc.name} />
          ) : (
            <Magazine />
          )}
        </div>
        {doc.name}
      </div>
      <div
        className={` group-hover:opacity-100 group-focus:opacity-100 ${
          isFocused ? 'opacity-100' : 'opacity-0'
        } transition-all flex gap-1.5 items-center caption text-label-base`}
      >
        <Button variant="tertiary" size="tiny" onClick={handleRemove}>
          <Trans>Remove</Trans>
        </Button>
        <Button variant="secondary" size="tiny" onClick={handleResync}>
          <Trans>Resync</Trans>
        </Button>
      </div>
    </a>
  );
};

export default memo(IndexedDocRow);
