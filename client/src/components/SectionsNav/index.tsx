import React, { Fragment, memo } from 'react';
import { SettingsTypesSections } from '../../types/general';
import SectionButton from './SectionButton';

interface Props<T> {
  sections: {
    Icon: (props: {
      raw?: boolean | undefined;
      sizeClassName?: string | undefined;
      className?: string | undefined;
    }) => JSX.Element;
    title: string;
    items: {
      type: T;
      label: string;
      onClick: (t: T) => void;
    }[];
  }[];
  activeItem: T;
}

function SectionsNav<T extends SettingsTypesSections>({
  sections,
  activeItem,
}: Props<T>) {
  return (
    <div className="flex flex-col gap-1 flex-1">
      {sections.map(({ title, Icon, items }) => (
        <Fragment key={title}>
          <div className="flex items-center gap-2 h-9 text-label-muted w-56">
            <Icon sizeClassName="w-4 h-4" />
            <p className="body-s-b">{title}</p>
          </div>
          {items.map((item) => (
            <SectionButton<T>
              key={item.label}
              type={item.type}
              label={item.label}
              isActive={item.type === activeItem}
              handleClick={item.onClick}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}

const genericMemo: <T>(
  component: T,
  propsAreEqual?: (
    prevProps: React.PropsWithChildren<T>,
    nextProps: React.PropsWithChildren<T>,
  ) => boolean,
) => T = memo;

export default genericMemo(SectionsNav);
