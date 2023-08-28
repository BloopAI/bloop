import { useCallback, useEffect, useRef, useState } from 'react';

const useScrollToBottom = (contentArray: any) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const handleScroll = useCallback(() => {
    if (messagesRef.current) {
      const scrollTop = messagesRef.current.scrollTop;
      const scrollHeight = messagesRef.current.scrollHeight;
      const clientHeight = messagesRef.current.clientHeight;

      setUserScrolledUp(scrollTop < scrollHeight - clientHeight);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current?.scrollTo({
        left: 0,
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom();
    }
  }, [contentArray, scrollToBottom, userScrolledUp]);

  return { messagesRef, handleScroll, scrollToBottom };
};

export default useScrollToBottom;
