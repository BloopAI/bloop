import { PropsWithChildren } from 'react';

type Props = { title: string; subtitle: string };

const SettingsText = ({
  title,
  subtitle,
  children,
}: PropsWithChildren<Props>) => {
  return (
    <div className="flex flex-col gap-1 flex-1">
      <p className="subhead-s text-label-title">{title}</p>
      <p className="body-s text-label-muted">{subtitle}</p>
      {children}
    </div>
  );
};

export default SettingsText;
