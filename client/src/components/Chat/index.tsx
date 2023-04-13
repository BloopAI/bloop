import { useContext, useRef, useState } from 'react';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { CloseSign, List } from '../../icons';
import { UIContext } from '../../context/uiContext';
import NLInput from './NLInput';
import ChipButton from './ChipButton';
import AllConversations from './AllCoversations';

const Chat = () => {
  const { isRightPanelOpen, setRightPanelOpen } = useContext(UIContext);
  const [isActive, setActive] = useState(false);
  const chatRef = useRef(null);
  useOnClickOutside(chatRef, () => setActive(false));

  return (
    <>
      <button
        className={`fixed z-50 bottom-20 w-13 h-13 rounded-full cursor-pointer ${
          isActive || isRightPanelOpen ? '-right-full' : 'right-8'
        } border border-gray-600 bg-gray-700 transition-all duration-300 ease-out-slow`}
        onClick={() => setActive(true)}
      >
        {/*<div>chat</div>*/}
      </button>
      <div
        ref={chatRef}
        className={`fixed z-50 bottom-20 rounded-xl group ${
          !isActive || isRightPanelOpen ? '-right-full' : 'right-8'
        } backdrop-blur-6 shadow-small bg-gray-800/50 transition-all duration-300 ease-out-slow`}
      >
        <div className="w-full max-h-0 group-hover:max-h-96 transition-all duration-200 overflow-hidden">
          <div className="px-4 pt-4 flex flex-col">
            <div className="flex justify-between gap-1 items-center">
              <ChipButton
                onClick={() => {
                  setRightPanelOpen(true);
                }}
              >
                <List /> All conversations
              </ChipButton>
              <ChipButton variant="filled" onClick={() => setActive(false)}>
                <CloseSign sizeClassName="w-3.5 h-3.5" />
              </ChipButton>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex flex-col w-95">
            <NLInput />
          </div>
        </div>
      </div>
      <AllConversations
        setHistoryOpen={setRightPanelOpen}
        isHistoryOpen={isRightPanelOpen}
        setActive={setActive}
      />
    </>
  );
};

export default Chat;
