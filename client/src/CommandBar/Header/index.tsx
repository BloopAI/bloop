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
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  value: string;
};

const CommandBarHeader = ({
  handleBack,
  breadcrumbs,
  customRightComponent,
  customSubmitHandler,
  onChange,
  value,
  placeholder,
}: Props) => {
  const { t } = useTranslation();
  const { isVisible } = useContext(CommandBarContext.General);
  const { setIsVisible } = useContext(CommandBarContext.Handlers);
  const [isComposing, setIsComposing] = useState(false);

  const onCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const onCompositionEnd = useCallback(() => {
    // this event comes before keydown and sets state faster causing unintentional submit
    setTimeout(() => setIsComposing(false), 10);
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
        } else if (e.key === 'Enter' && customSubmitHandler && !isComposing) {
          e.stopPropagation();
          e.preventDefault();
          customSubmitHandler(value);
        }
      }
    },
    [
      isVisible,
      setIsVisible,
      handleBack,
      customSubmitHandler,
      value,
      isComposing,
    ],
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
        onChange={onChange}
        placeholder={placeholder || t('Search projects or commands...')}
        type="search"
        autoComplete="off"
        autoCorrect="off"
        className="w-full bg-transparent outline-none focus:outline-0 body-base placeholder:text-label-muted"
        autoFocus
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />
    </div>
  );
};

export default memo(CommandBarHeader);
