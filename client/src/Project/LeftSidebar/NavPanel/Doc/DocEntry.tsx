import React, { memo, useCallback, useContext } from 'react';
import { DocPageType } from '../../../../types/api';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import { FileIcon } from '../../../../icons';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';

type Props = DocPageType & {
  index: string;
  favicon?: string;
};

const DocEntry = ({
  index,
  doc_id,
  doc_title,
  relative_url,
  favicon,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const onClick = useCallback(() => {
    openNewTab({
      type: TabTypesEnum.DOC,
      title: doc_title,
      docId: doc_id,
      favicon,
      relativeUrl: relative_url,
    });
  }, [openNewTab, doc_id, doc_title, favicon, relative_url]);

  const { isFocused, props } = useArrowNavigationItemProps<HTMLAnchorElement>(
    index,
    onClick,
  );

  return (
    <a
      href="#"
      className={`w-full text-left h-7 flex-shrink-0 flex items-center gap-3 pr-2 cursor-pointer
        ellipsis body-mini group pl-10.5 ${
          isFocused ? 'bg-bg-sub-hover text-label-title' : 'text-label-base'
        }`}
      {...props}
    >
      <FileIcon sizeClassName="w-3.5 h-3.5" />
      <span className="ellipsis">{doc_title}</span>
    </a>
  );
};

export default memo(DocEntry);
