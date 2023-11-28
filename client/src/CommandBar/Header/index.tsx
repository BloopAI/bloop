import {
  ChangeEvent,
  memo,
  ReactElement,
  useCallback,
  useContext,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../../components/Tooltip';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { CommandBarContext } from '../../context/commandBarContext';
import ChipItem from './ChipItem';

type Props = {
  handleBack?: () => void;
  breadcrumbs?: string[];
  customRightComponent?: ReactElement;
  customSubmitHandler?: (value: string) => void;
};

const CommandBarHeader = ({
  handleBack,
  breadcrumbs,
  customRightComponent,
  customSubmitHandler,
}: Props) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const { isVisible, setIsVisible } = useContext(CommandBarContext.General);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (isVisible) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          if (handleBack) {
            handleBack();
          } else {
            setIsVisible(false);
          }
        } else if (e.key === 'Enter' && customSubmitHandler) {
          e.stopPropagation();
          e.preventDefault();
          customSubmitHandler(value);
          setValue('');
        }
      }
    },
    [isVisible, setIsVisible, handleBack, customSubmitHandler, value],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="w-full flex flex-col p-4 items-start gap-4 border-b border-bg-border">
      <div className="flex gap-1 items-center justify-between w-full select-none">
        <div className="flex gap-1 items-center">
          {!!handleBack && (
            <Tooltip text={t('Back')} placement={'top'}>
              <button
                className="w-5 flex gap-1 items-center justify-center rounded border border-bg-border code-mini text-label-base ellipsis"
                onClick={handleBack}
              >
                ←
              </button>
            </Tooltip>
          )}
          {breadcrumbs?.map((b) => <ChipItem key={b} text={b} />)}
        </div>
        {customRightComponent}
      </div>
      <input
        value={value}
        onChange={handleChange}
        placeholder={t('Search projects or commands...')}
        type="search"
        autoComplete="off"
        autoCorrect="off"
        className="w-full bg-transparent outline-none focus:outline-0 body-base placeholder:text-label-muted"
        autoFocus
      />
    </div>
  );
};

export default memo(CommandBarHeader);
