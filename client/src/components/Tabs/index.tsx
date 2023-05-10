import { ReactNode, useEffect, useRef, useState } from 'react';

type Props = {
  activeTab: number;
  onTabChange?: (i: number) => void;
  tabs: { title?: string; iconLeft?: ReactNode; iconRight?: ReactNode }[];
  size?: 'small' | 'medium' | 'large';
  variant?: 'link' | 'button';
  fullWidth?: boolean;
  divider?: boolean;
};

const sizeMap = {
  small: 'h-8 caption-strong',
  medium: 'h-10 callout',
  large: 'h-11.5 callout',
};

const variantMap = {
  link: 'pb-3 duration-300 ease-in-slow',
  button: 'px-2 py-0 duration-150 ease-in-out',
};

const Tabs = ({
  activeTab,
  onTabChange,
  tabs,
  size = 'medium',
  variant = 'link',
  fullWidth,
  divider,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (containerRef.current) {
      const containerPosition = containerRef.current.getBoundingClientRect();
      const tab = containerRef.current.children[activeTab];
      const tabPosition = tab.getBoundingClientRect();
      setPosition({
        left: tabPosition.left - containerPosition.left,
        width: tabPosition.width,
      });
    }
  }, [activeTab]);

  return (
    <div
      className={`text-label-base flex items-center ${
        variant === 'link' ? 'gap-5' : 'rounded-4 border border-bg-border'
      } relative ${fullWidth ? 'w-full' : ''} z-10 ${
        divider ? 'divide-x divide-bg-border' : ''
      } select-none`}
      ref={containerRef}
    >
      {tabs.map((t, i) => (
        <button
          key={`${t.title}${i}`}
          className={`${divider ? '' : 'border-none'} ${variantMap[variant]} ${
            sizeMap[size]
          } focus:outline-none flex items-center p-0 gap-2 rounded-none ${
            activeTab === i
              ? 'text-bg-main focus:text-bg-main-hover'
              : 'hover:text-label-title focus:text-label-title'
          } transition-all outline-none outline-0 bg-transparent ${
            fullWidth ? 'flex-1 justify-center' : ''
          }`}
          onClick={() => onTabChange?.(i)}
        >
          {t.iconLeft || null}
          {t.title ? <span>{t.title}</span> : ''}
          {t.iconRight || null}
        </button>
      ))}
      {variant === 'link' ? (
        <span
          className="absolute bottom-0 h-[1px] bg-bg-main transition-all duration-300 ease-in-slow"
          style={position}
        />
      ) : (
        <span
          style={{ left: position.left - 1, width: position.width }}
          className="absolute bottom-0 top-0 -z-10 bg-bg-base transition-all duration-300 ease-in-slow"
        />
      )}
    </div>
  );
};

export default Tabs;
