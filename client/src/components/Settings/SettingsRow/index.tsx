import { PropsWithChildren } from 'react';

const SettingsRow = ({ children }: PropsWithChildren) => {
  return (
    <div className="border-t border-t-bg-border flex justify-between gap-2 py-6">
      {children}
    </div>
  );
};

export default SettingsRow;
