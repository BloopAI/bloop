import { memo, useEffect, useState } from 'react';
import { Trans } from 'react-i18next';
import { getDocSections, getIndexedPages } from '../../../services/api';
import { DocPageType, DocSectionType } from '../../../types/api';
import KeyboardChip from '../KeyboardChip';
import RenderedSection from './RenderedSection';

type Props = {
  docId: string;
  handleSelectPage: (url: string) => void;
};

const PagesWithPreview = ({ docId, handleSelectPage }: Props) => {
  const [indexedPages, setIndexedPages] = useState<DocPageType[]>([]);
  const [previewingIndex, setPreviewingIndex] = useState(0);
  const [previewingSections, setPreviewingSections] = useState<
    DocSectionType[]
  >([]);

  useEffect(() => {
    getIndexedPages(docId).then((resp) => {
      setIndexedPages(resp);
    });
  }, [docId]);

  useEffect(() => {
    if (indexedPages[previewingIndex]) {
      getDocSections(docId, indexedPages[previewingIndex].relative_url).then(
        (resp) => {
          setPreviewingSections(resp);
        },
      );
    }
  }, [docId, indexedPages, previewingIndex]);

  return (
    <div className="w-full flex flex-col overflow-hidden">
      <div className="flex overflow-hidden">
        <div className="w-2/5 border-r border-bg-border overflow-y-auto">
          {indexedPages.map((p, i) => (
            <button
              key={p.relative_url}
              type="button"
              onMouseOver={() => setPreviewingIndex(i)}
              onFocus={() => setPreviewingIndex(i)}
              onClick={() => handleSelectPage(p.relative_url)}
              className="relative h-9 px-3 group rounded-6 bg-bg-shade hover:bg-bg-base-hover focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0"
            >
              <div className="body-s text-label-base group-hover:text-label-title group-focus:text-label-title ellipsis flex gap-2 items-center">
                {p.doc_title}
              </div>
              <div className="absolute top-1 right-0 opacity-0 bg-bg-base-hover px-2 py-1 group-hover:opacity-100 group-focus:opacity-100 transition-all flex gap-1.5 items-center caption text-label-base">
                Select whole page
                <KeyboardChip type="entr" variant="tertiary" />
              </div>
            </button>
          ))}
        </div>
        <div className="w-3/5 flex flex-col gap-3 p-3 overflow-y-auto">
          {previewingSections.map((s) => {
            return <RenderedSection text={s.text} key={s.point_id} />;
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(PagesWithPreview);
