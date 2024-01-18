import React, { Dispatch, memo, SetStateAction, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Dropdown from '../../../../components/Dropdown';
import {
  ArrowTriangleBottomIcon,
  ChatBubblesIcon,
  MoreHorizontalIcon,
} from '../../../../icons';
import Button from '../../../../components/Button';
import { ProjectContext } from '../../../../context/projectContext';
import { useNavPanel } from '../../../../hooks/useNavPanel';
import ConversationsDropdown from './ConversationsDropdown';
import ConversationEntry from './CoversationEntry';

type Props = {
  setExpanded: Dispatch<SetStateAction<string>>;
  isExpanded: boolean;
  focusedIndex: string;
  index: string;
};

const reactRoot = document.getElementById('root')!;

const ConversationsNav = ({
  isExpanded,
  setExpanded,
  focusedIndex,
  index,
}: Props) => {
  const { t } = useTranslation();
  const { project } = useContext(ProjectContext.Current);
  const { containerRef, toggleExpanded, noPropagate, isLeftSidebarFocused } =
    useNavPanel(index, setExpanded, isExpanded, focusedIndex);

  return (
    <div className="select-none overflow-hidden w-full flex-shrink-0">
      <span
        role="button"
        tabIndex={0}
        className={`h-10 flex items-center gap-3 px-4 ellipsis ${
          isExpanded ? 'sticky z-10 top-0 left-0' : ''
        } ${focusedIndex === index ? 'bg-bg-sub-hover' : 'bg-bg-sub'}`}
        onClick={toggleExpanded}
        ref={containerRef}
        data-node-index={index}
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
      {isExpanded && (
        <div className={'overflow-hidden'}>
          {project?.conversations.map((c) => (
            <ConversationEntry
              key={c.id}
              {...c}
              index={`${index}-${c.id}`}
              focusedIndex={focusedIndex}
              isLeftSidebarFocused={isLeftSidebarFocused}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(ConversationsNav);
