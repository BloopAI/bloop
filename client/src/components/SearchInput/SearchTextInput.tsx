import {
  ChangeEvent,
  ForwardedRef,
  forwardRef,
  HTMLInputTypeAttribute,
  KeyboardEvent,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronDownFilled,
  ChevronUpFilled,
  NaturalLanguage,
  RegexIcon,
} from '../../icons';
import ClearButton from '../ClearButton';
import RegexButton from '../RegexButton';
import ContextMenu from '../ContextMenu';
import { MenuItemType, SearchType, SyncStatus } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { AnalyticsContext } from '../../context/analyticsContext';
import { RepositoriesContext } from '../../context/repositoriesContext';
import ModalOrSidebar from '../ModalOrSidebar';
import Button from '../Button';

type Props = {
  value: string;
  placeholder?: string;
  label?: string;
  helperText?: string;
  id?: string;
  name: string;
  error?: string | null;
  success?: boolean;
  disabled?: boolean;
  regex?: boolean;
  variant?: 'outlined' | 'filled';
  type?: HTMLInputTypeAttribute;
  onSubmit?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onRegexClick?: () => void;
  validate?: () => void;
  regexEnabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  searchType: SearchType;
  onSearchTypeChanged: (searchType: SearchType) => void;
};

const borderMap = {
  filled: {
    default:
      'border-transparent hover:border-gray-500 focus-within:border-gray-500',
    error: 'border-danger-500',
    disabled: 'border-gray-700',
  },
  outlined: {
    default:
      'border-gray-700 hover:border-gray-500 focus-within:border-gray-500',
    error: 'border-danger-500',
    disabled: 'border-gray-700',
  },
};

const SearchTextInput = forwardRef(function TextInputWithRef(
  {
    value,
    onChange,
    placeholder,
    label,
    helperText,
    id,
    name,
    error,
    success,
    disabled,
    variant = 'outlined',
    type,
    onSubmit,
    validate,
    regex,
    onRegexClick,
    regexEnabled,
    searchType,
    onSearchTypeChanged,
  }: Props,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current!);
  const [searchCtxMenuVisible, setSearchCtxMenuVisible] = useState(false);
  const { isSelfServe } = useContext(DeviceContext);
  const { isGithubConnected } = useContext(UIContext);
  const { isAnalyticsAllowed } = useContext(AnalyticsContext);
  const [composing, setComposition] = useState(false);
  const startComposition = () => setComposition(true);
  const endComposition = () => setComposition(false);
  const { repositories } = useContext(RepositoriesContext);
  const [showModal, setShowModal] = useState(false);

  const isDisabled = useMemo(
    () =>
      !repositories?.find(
        (r) =>
          r.last_index &&
          r.last_index !== '1970-01-01T00:00:00Z' &&
          r.sync_status !== SyncStatus.Removed,
      ),
    [repositories],
  );

  const handleEnter = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter' && onSubmit) {
      if (composing) return;
      e.preventDefault();
      onSubmit(e);
    }
    if (e.key === 'Escape' && !value) {
      e.stopPropagation();
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  const handleRegex = () => {
    onRegexClick?.();
  };

  const handleInputClick = () => {
    if (isDisabled) {
      setShowModal(true);
    }
  };

  return (
    <div
      className={`flex flex-col gap-1 w-full ${
        disabled ? 'text-gray-500' : 'text-gray-100'
      } body-s`}
      onClick={handleInputClick}
    >
      <div
        className={`group border h-10 rounded flex box-border items-center ${
          disabled || isDisabled
            ? borderMap[variant].disabled
            : error
            ? borderMap[variant].error
            : borderMap[variant].default
        } ${
          disabled
            ? 'bg-transparent '
            : variant === 'filled'
            ? 'bg-gray-800'
            : ''
        } transition-all duration-300 ease-in-bounce relative`}
      >
        <span className="relative h-full">
          <ContextMenu
            items={[
              {
                text: 'Natural language',
                type: MenuItemType.LINK,
                disabled:
                  !isSelfServe && (!isAnalyticsAllowed || !isGithubConnected),
                tooltip:
                  !isSelfServe && (!isAnalyticsAllowed || !isGithubConnected)
                    ? `${
                        !isAnalyticsAllowed
                          ? 'Opt-in to remote services'
                          : 'Connect GitHub'
                      } to use natural language search`
                    : undefined,
                onClick: () => onSearchTypeChanged(SearchType.NL),
                icon: <NaturalLanguage />,
              },
              {
                text: 'Regex',
                type: MenuItemType.LINK,
                onClick: () => onSearchTypeChanged(SearchType.REGEX),
                icon: <RegexIcon />,
              },
            ]}
            visible={searchCtxMenuVisible}
            title={'Search type'}
            handleClose={() => setSearchCtxMenuVisible(false)}
            closeOnClickOutside
          >
            <button
              className="flex items-center px-2 h-full bg-gray-700 rounded-l"
              title="Search type"
              disabled={isDisabled}
              onClick={(e) => {
                e.preventDefault();
                setSearchCtxMenuVisible(!searchCtxMenuVisible);
              }}
            >
              <span
                className={`w-5 h-5 ${
                  isDisabled ? '' : 'group-hover:text-gray-200'
                } ${
                  searchCtxMenuVisible
                    ? 'text-gray-200'
                    : isDisabled
                    ? 'text-gray-500'
                    : 'text-gray-300'
                }`}
              >
                {searchType === SearchType.NL ? (
                  <NaturalLanguage />
                ) : (
                  <RegexIcon />
                )}
              </span>
              <span
                className={`w-5 h-5 ${
                  isDisabled ? '' : 'group-hover:text-gray-200'
                } ${searchCtxMenuVisible ? 'text-gray-200' : 'text-gray-500'}`}
              >
                {searchCtxMenuVisible ? (
                  <ChevronUpFilled />
                ) : (
                  <ChevronDownFilled />
                )}
              </span>
            </button>
          </ContextMenu>
        </span>
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          id={id}
          name={name}
          type={type}
          disabled={disabled || isDisabled}
          ref={inputRef}
          onBlur={validate}
          autoComplete="off"
          spellCheck="false"
          className={`bg-transparent border-none focus:outline-none w-full group-focus-within:placeholder:text-gray-100 disabled:placeholder:text-gray-500 ${
            type === 'email' ? 'px-1' : 'pl-2.5'
          } transition-all duration-300 ease-in-bounce outline-none outline-0 pr-9`}
          onKeyDown={handleEnter}
          onCompositionStart={startComposition}
          onCompositionEnd={endComposition}
        />
        {value ? (
          <ClearButton
            tabIndex={-1}
            onClick={() => {
              onChange({
                target: { value: '', name },
              } as ChangeEvent<HTMLInputElement>);
              inputRef.current?.focus();
            }}
            className={success ? 'group-focus-within:flex hidden' : 'flex'}
          />
        ) : null}
        {regex && searchType === SearchType.REGEX && !isDisabled ? (
          <RegexButton
            onClick={handleRegex}
            clasName={'mr-2'}
            active={!!regexEnabled}
          />
        ) : (
          ''
        )}
      </div>
      {error ? <span className="text-danger-500 caption">{error}</span> : null}
      <ModalOrSidebar
        shouldStretch={false}
        isSidebar={false}
        shouldShow={showModal}
        onClose={() => setShowModal(false)}
        isModalSidebarTransition={false}
        setIsModalSidebarTransition={() => {}}
        top="7rem"
      >
        <div className="w-[484px] bg-gray-900">
          <img
            src="/wait-for-repos-to-sync.png"
            alt="Wait for repos to sync"
            className="w-full"
          />
          <div className="flex flex-col gap-8 p-6">
            <div className="flex flex-col gap-3 text-center">
              <h4 className="text-gray-200">Your repos are still syncing</h4>
              <p className="body-s text-gray-500">
                At least one repository needs to be synced to access Search. We
                will send you a notification when it’s ready.
              </p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(false);
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      </ModalOrSidebar>
    </div>
  );
});

export default SearchTextInput;
