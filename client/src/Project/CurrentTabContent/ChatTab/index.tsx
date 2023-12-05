import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import { ChatBubblesIcon, MoreHorizontalIcon } from '../../../icons';
import Conversation from './Conversation';

type Props = {
  noBorder?: boolean;
};

const ChatTab = ({ noBorder }: Props) => {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      <div className="w-full h-10 px-4 flex justify-between items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          <ChatBubblesIcon
            sizeClassName="w-4 h-4"
            className="text-brand-default"
          />
          New chat
        </div>
        <Button
          variant="tertiary"
          size="mini"
          onlyIcon
          title={t('More actions')}
        >
          <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 flex flex-col max-w-full px-4 pt-4 overflow-auto">
        <Conversation />
      </div>
    </div>
  );
};

export default memo(ChatTab);
