import { memo, useCallback, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CommandBarContext } from '../../context/commandBarContext';
import Dropdown from '../../components/Dropdown';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import HintButton from './HintButton';

type Props = {
  ActionsDropdown?: (props: any) => JSX.Element | null;
  actionsDropdownProps?: Record<string, any>;
  onDropdownVisibilityChange?: (isVisible: boolean) => void;
};

const CommandBarFooter = ({
  ActionsDropdown,
  actionsDropdownProps,
  onDropdownVisibilityChange,
}: Props) => {
  const { t } = useTranslation();
  const { focusedItem } = useContext(CommandBarContext.FooterValues);
  const actionsBtn = useRef<HTMLDivElement>(null);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      actionsBtn.current?.click();
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent, !ActionsDropdown);

  return (
    <div className="flex items-center gap-1 w-full py-2.5 pl-4 pr-3 border-t border-bg-border">
      <p className="text-label-base code-mini flex-1">
        {focusedItem?.footerHint}
      </p>
      {focusedItem?.footerBtns?.map((b) => <HintButton key={b.label} {...b} />)}
      {!!ActionsDropdown && (
        <Dropdown
          dropdownPlacement="top-end"
          color="base"
          DropdownComponent={ActionsDropdown}
          dropdownComponentProps={actionsDropdownProps}
          appendTo={document.body}
          onVisibilityChange={onDropdownVisibilityChange}
        >
          <HintButton
            shortcut={['cmd', 'K']}
            label={t('Actions')}
            ref={actionsBtn}
          />
        </Dropdown>
      )}
    </div>
  );
};

export default memo(CommandBarFooter);
