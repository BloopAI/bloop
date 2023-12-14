import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  MouseEvent,
  useContext,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Dropdown from '../../../components/Dropdown';
import {
  ArrowTriangleBottomIcon,
  ChatBubblesIcon,
  MoreHorizontalIcon,
} from '../../../icons';
import Button from '../../../components/Button';
import { ProjectContext } from '../../../context/projectContext';
import ConversationsDropdown from './ConversationsDropdown';
import ConversationEntry from './CoversationEntry';

type Props = {
  setExpanded: Dispatch<SetStateAction<number>>;
  isExpanded: boolean;
};

const reactRoot = document.getElementById('root')!;

const ConversationsNav = ({ isExpanded, setExpanded }: Props) => {
  const { t } = useTranslation();
  const { project } = useContext(ProjectContext.Current);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => (prev === 0 ? -1 : 0));
  }, []);

  useEffect(() => {
    if (isExpanded) {
      // containerRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isExpanded]);

  const noPropagate = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
  }, []);

  return (
    <div className="select-none overflow-hidden w-full" ref={containerRef}>
      <span
        role="button"
        tabIndex={0}
        className={`h-10 flex items-center gap-3 px-4 bg-bg-sub ellipsis ${
          isExpanded ? 'sticky z-10 top-0 left-0' : ''
        }`}
        onClick={toggleExpanded}
      >
        <ChatBubblesIcon
          sizeClassName="w-3.5 h-3.5"
          className="text-brand-default"
        />
        <p className="flex items-center gap-1 body-s-b flex-1 ellipsis">
          <span className="text-label-title ellipsis">
            <Trans>Chat conversations</Trans>
          </span>
          {isExpanded && (
            <ArrowTriangleBottomIcon
              sizeClassName="w-2 h-2"
              className="text-label-muted"
            />
          )}
        </p>
        {isExpanded && (
          <div onClick={noPropagate}>
            <Dropdown
              DropdownComponent={ConversationsDropdown}
              appendTo={reactRoot}
              dropdownPlacement="bottom-start"
              size="auto"
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
      <div
        style={{
          maxHeight: isExpanded ? undefined : 0,
        }}
        className={'overflow-hidden'}
      >
        {project?.conversations.map((c) => (
          <ConversationEntry key={c.id} {...c} />
        ))}
      </div>
    </div>
  );
};

export default memo(ConversationsNav);
