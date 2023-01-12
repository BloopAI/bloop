import React from 'react';
import NavBar from '../NavBar';
import StatusBar from '../StatusBar';

type Props = {
  children: React.ReactNode;
};

const mainContainerStyle = { height: 'calc(100vh - 8rem)' };
const PageTemplate = ({ children }: Props) => {
  return (
    <div className="text-gray-200">
      <NavBar userSigned />
      <div
        className="flex my-16 w-screen overflow-hidden relative z-10"
        style={mainContainerStyle}
      >
        {children}
      </div>
      <StatusBar />
    </div>
  );
};
export default PageTemplate;
