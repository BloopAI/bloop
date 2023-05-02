import React, { useContext, useEffect } from 'react';
import NavBar from '../NavBar';
import StatusBar from '../StatusBar';
import Chat from '../Chat';
import { ChatContext } from '../../context/chatContext';
import Subheader from './Subheader';

type Props = {
  children: React.ReactNode;
  withSearchBar: boolean;
  renderPage:
    | 'results'
    | 'repo'
    | 'full-result'
    | 'nl-result'
    | 'no-results'
    | 'home'
    | 'conversation-result';
};

const mainContainerStyle = { height: 'calc(100vh - 9.5rem)' };
const PageTemplate = ({ children, withSearchBar, renderPage }: Props) => {
  const { setShowTooltip, setTooltipText } = useContext(ChatContext);

  useEffect(() => {
    let timerId: number;
    if (renderPage === 'repo') {
      timerId = window.setTimeout(() => {
        setTooltipText('Ask me a question!');
        setShowTooltip(true);
      }, 1000);
    } else {
      setShowTooltip(false);
    }
    return () => {
      clearTimeout(timerId);
    };
  }, [renderPage]);

  return (
    <div className="text-gray-200">
      <NavBar />
      <div className="mt-8" />
      {withSearchBar && <Subheader />}
      <div
        className="flex mb-16 w-screen overflow-hidden relative"
        style={mainContainerStyle}
      >
        {children}
        {withSearchBar && <Chat />}
      </div>
      <StatusBar />
    </div>
  );
};
export default PageTemplate;
