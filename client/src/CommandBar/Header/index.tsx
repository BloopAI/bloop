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

type PropsWithoutInput = {
  noInput: true;
  customSubmitHandler?: never;
  onChange?: never;
  value?: never;
  placeholder?: never;
};

type PropsWithInput = {
  noInput?: false;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  customSubmitHandler?: (value: string) => void;
  placeholder?: string;
};

type GeneralProps = {
  handleBack?: () => void;
  breadcrumbs?: string[];
  customRightComponent?: ReactElement;
  disableKeyNav?: boolean;
};

type Props = GeneralProps & (PropsWithInput | PropsWithoutInput);

const CommandBarHeader = ({
  handleBack,
  breadcrumbs,
  customRightComponent,
  customSubmitHandler,
  onChange,
  value,
  placeholder,
  noInput,
  disableKeyNav,
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
      if (
        e.key === 'Escape' ||
        (e.key === 'Backspace' && !value && !isComposing)
      ) {
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
    },
    [setIsVisible, handleBack, customSubmitHandler, value, isComposing],
  );
  useKeyboardNavigation(handleKeyEvent, !isVisible || disableKeyNav);

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
      {!noInput && (
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder || t('Search projects or commands...')}
          type="search"
          id="command-input"
          autoComplete="off"
          autoCorrect="off"
          className="w-full bg-transparent outline-none focus:outline-0 body-base placeholder:text-label-muted"
          autoFocus
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          disabled={disableKeyNav}
        />
      )}
    </div>
  );
};

export default memo(CommandBarHeader);
