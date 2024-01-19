import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DocPageType } from '../../../../types/api';
import { useNavPanel } from '../../../../hooks/useNavPanel';
import { getIndexedPages } from '../../../../services/api';
import {
  ArrowTriangleBottomIcon,
  MagazineIcon,
  MoreHorizontalIcon,
} from '../../../../icons';
import Dropdown from '../../../../components/Dropdown';
import Button from '../../../../components/Button';
import DocDropdown from './DocDropdown';
import DocEntry from './DocEntry';

type Props = {
  setExpanded: Dispatch<SetStateAction<string>>;
  isExpanded: boolean;
  projectId: string;
  focusedIndex: string;
  index: string;
  docId: string;
  favicon?: string;
  title?: string;
  url: string;
};

const reactRoot = document.getElementById('root')!;

const DocNav = ({
  isExpanded,
  setExpanded,
  projectId,
  focusedIndex,
  index,
  favicon,
  docId,
  title,
  url,
}: Props) => {
  const { t } = useTranslation();
  const [pages, setPages] = useState<DocPageType[]>([]);
  const {
    containerRef,
    toggleExpanded,
    noPropagate,
    isLeftSidebarFocused,
    isCommandBarVisible,
  } = useNavPanel(index, setExpanded, isExpanded, focusedIndex);

  const fetchPages = useCallback(async () => {
    const resp = await getIndexedPages(docId);
    console.log(resp);
    setPages(resp);
  }, [docId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const dropdownComponentProps = useMemo(() => {
    return {
      key: docId,
      docId,
    };
  }, [docId]);

  return (
    <div className="select-none flex-shrink-0">
      <span
        role="button"
        tabIndex={0}
        className={`h-10 flex items-center gap-3 px-4 ellipsis ${
          isExpanded ? 'sticky z-10 top-0 left-0' : ''
        } ${focusedIndex === index ? 'bg-bg-sub-hover' : 'bg-bg-sub'}`}
        onClick={toggleExpanded}
        data-node-index={index}
        ref={containerRef}
      >
        {favicon ? (
          <img src={favicon} alt={title || url} className={'w-3.5 h-3.5'} />
        ) : (
          <MagazineIcon sizeClassName="w-3.5 h-3.5" />
        )}
        <p className="flex items-center gap-1 body-s-b flex-1 ellipsis">
          <span className="text-label-title">{title}</span>
          {isExpanded && <ArrowTriangleBottomIcon sizeClassName="w-2 h-2" />}
        </p>
        {isExpanded && (
          <div onClick={noPropagate}>
            <Dropdown
              DropdownComponent={DocDropdown}
              dropdownComponentProps={dropdownComponentProps}
              appendTo={reactRoot}
              dropdownPlacement="bottom-start"
            >
              <Button
                variant="tertiary"
                size="mini"
                onlyIcon
                title={t('More actions')}
              >
                <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
              </Button>
            </Dropdown>
          </div>
        )}
      </span>
      {isExpanded && (
        <div
          className={`relative ${
            isExpanded ? 'overflow-auto' : 'overflow-hidden'
          }`}
        >
          <div className="absolute top-0 bottom-0 left-[1.375rem] w-px bg-bg-border" />
          {pages.map((p) => (
            <DocEntry
              key={p.absolute_url}
              {...p}
              focusedIndex={focusedIndex}
              index={`${index}-${p.absolute_url}`}
              isLeftSidebarFocused={isLeftSidebarFocused}
              isCommandBarVisible={isCommandBarVisible}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(DocNav);
