import React, { useState } from 'react';
import ChipButton from '../ChipButton';
import { ArrowLeft, CheckIcon, Checkmark, CloseSign } from '../../../icons';
import ConversationMessage from '../ConversationMessage';
import NLInput from '../NLInput';
import ConversationListItem from './ConversationListItem';

type Props = {
  isHistoryOpen: boolean;
  setHistoryOpen: (b: boolean) => void;
  setActive: (b: boolean) => void;
};

const AllConversations = ({
  isHistoryOpen,
  setHistoryOpen,
  setActive,
}: Props) => {
  const [openItem, setOpenItem] = useState<number | null>(null);
  return (
    <div
      className={`w-97 border-l border-gray-800 h-full flex flex-col relative ${
        isHistoryOpen ? 'mr-0' : '-mr-97'
      } transition-all duration-300 ease-out-slow`}
    >
      <div className="p-4 bg-gray-900/75 border-b border-gray-800 backdrop-blur-6 flex items-center gap-2 text-gray-200">
        {!!openItem && (
          <ChipButton variant="filled" onClick={() => setOpenItem(null)}>
            <ArrowLeft sizeClassName="w-4 h-4" />
          </ChipButton>
        )}
        <p className="flex-1 body-m">
          {openItem ? 'Where are the ctags?' : 'Conversations'}
        </p>
        {!openItem && (
          <ChipButton
            onClick={() => {
              setHistoryOpen(false);
              setActive(true);
            }}
          >
            Create new
          </ChipButton>
        )}
        <ChipButton variant="filled" onClick={() => setHistoryOpen(false)}>
          <CloseSign sizeClassName="w-3.5 h-3.5" />
        </ChipButton>
      </div>
      {!openItem && (
        <div className="flex flex-col gap-1 py-4 overflow-auto">
          <ConversationListItem
            title="Where are ctags?"
            subtitle="Monday, July 12, 2:36 PM"
            onClick={() => setOpenItem(1)}
            onDelete={() => {}}
          />
          <ConversationListItem
            title="Lorem ipsum dolor sit amet consecteturd sdfmnsf"
            subtitle="Monday, July 12, 2:36 PM"
            onClick={() => setOpenItem(1)}
            onDelete={() => {}}
          />
          <ConversationListItem
            title="Where are ctags?"
            subtitle="Monday, July 12, 2:36 PM"
            onClick={() => setOpenItem(1)}
            onDelete={() => {}}
          />
          <ConversationListItem
            title="Where are ctags?"
            subtitle="Monday, July 12, 2:36 PM"
            onClick={() => setOpenItem(1)}
            onDelete={() => {}}
          />
        </div>
      )}
      {!!openItem && (
        <div className="p-4 flex flex-col gap-3 overflow-auto flex-1 pb-24">
          <ConversationMessage author="user" message="Where are the ctags?" />
          <div className="flex gap-2 px-4 items-center">
            <div className="text-success-500 h-5">
              <Checkmark />
            </div>
            <p className="caption text-gray-400 flex-1">Answer Ready</p>
            <button
              className="text-primary-300 caption mr-2"
              onClick={() => {}}
            >
              Show
            </button>
          </div>
          <ConversationMessage
            author="server"
            message={`It seems you're looking at a binary file for ctags specific to the x86_64 Apple Darwin architecture. The binary file itself is not human-readable and is intended to be executed by the system.`}
          />
          <ConversationMessage
            author="user"
            message="What are the most common practicalities for ctags usage in bloop?"
          />
          <div className="flex gap-2 px-4 items-center">
            <div className="text-success-500 h-5">
              <Checkmark />
            </div>
            <p className="caption text-gray-400 flex-1">Answer Ready</p>
            <button
              className="text-primary-300 caption mr-2"
              onClick={() => {}}
            >
              Show
            </button>
          </div>
          <ConversationMessage
            author="server"
            message={`Some practical aspects of using ctags in conjunction with bleep include:
- Installation: Make sure to install universal-ctags with JSON support. You can verify it by running ctags --version and checking for +json in the list of compiled features.
- Usage: ctags works in the background with the bleep server to provide fast code search and navigation.
- Integration: Programs and plugins like Vim, Emacs, and Visual Studio Code can utilize ctags to enable features like "go to definition" and "find all references."`}
          />
          <ConversationMessage
            author="server"
            message={`Some practical aspects of using ctags in conjunction with bleep include:
- Installation: Make sure to install universal-ctags with JSON support. You can verify it by running ctags --version and checking for +json in the list of compiled features.
- Usage: ctags works in the background with the bleep server to provide fast code search and navigation.
- Integration: Programs and plugins like Vim, Emacs, and Visual Studio Code can utilize ctags to enable features like "go to definition" and "find all references."`}
          />
        </div>
      )}
      <div className="backdrop-blur-6 bg-gray-900/75 absolute bottom-0 left-0">
        <div
          className="flex flex-col p-4 gap-3 group relative"
          onClick={() => {
            setActive(true);
            setHistoryOpen(false);
          }}
        >
          <NLInput />
        </div>
      </div>
    </div>
  );
};

export default AllConversations;
