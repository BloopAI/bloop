import { memo, PropsWithChildren, useMemo, useState } from 'react';
import { ChatContext, ChatsContext } from '../chatsContext';

type Props = {};

const ChatsContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [chats, setChats] = useState<Record<string, ChatContext>>({});

  const contextValue = useMemo(
    () => ({
      chats,
      setChats,
    }),
    [chats],
  );
  return (
    <ChatsContext.Provider value={contextValue}>
      {children}
    </ChatsContext.Provider>
  );
};

export default memo(ChatsContextProvider);
