import {
  ChangeEvent,
  HTMLInputTypeAttribute,
  KeyboardEvent,
  useContext,
  useEffect,
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
import { MenuItemType, SearchType } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { AnalyticsContext } from '../../context/analyticsContext';

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
  onSubmit: () => void;
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

const SearchTextInput = function TextInputWithRef({
  value,
  onChange,
  placeholder,
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
}: Props) {
  const [searchCtxMenuVisible, setSearchCtxMenuVisible] = useState(false);
  const { isSelfServe } = useContext(DeviceContext);
  const {
    isGithubConnected,
    uiRefs: {
      searchInputRef,
      searchTypeSelectBtn,
      searchTypeNLBtn,
      searchTypeRegexBtn,
      searchSubmitRef,
    },
  } = useContext(UIContext);
  const { isAnalyticsAllowed } = useContext(AnalyticsContext);

  useEffect(() => {
    searchSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape' && !value) {
      e.stopPropagation();
      e.preventDefault();
      searchInputRef.current?.blur();
    }
  };

  const handleRegex = () => {
    onRegexClick?.();
  };

  return (
    <div
      className={`flex flex-col gap-1 w-full ${
        disabled ? 'text-gray-500' : 'text-gray-100'
      } body-s`}
    >
      <div
        className={`group border h-10 rounded flex box-border items-center ${
          disabled
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
                btnRef: searchTypeNLBtn,
                icon: <NaturalLanguage />,
              },
              {
                text: 'Regex',
                type: MenuItemType.LINK,
                onClick: () => onSearchTypeChanged(SearchType.REGEX),
                btnRef: searchTypeRegexBtn,
                icon: <RegexIcon />,
              },
            ]}
            visible={searchCtxMenuVisible}
            title={'Search type'}
            handleClose={() => setSearchCtxMenuVisible(false)}
            closeOnClickOutside
          >
            <button
              className={`flex items-center px-2 h-full bg-gray-700 rounded-l hover:text-gray-200 focus:text-gray-200 ${
                searchCtxMenuVisible ? 'text-gray-200' : 'text-gray-500'
              }`}
              title="Search type"
              onClick={(e) => {
                e.preventDefault();
                setSearchCtxMenuVisible(!searchCtxMenuVisible);
              }}
              ref={searchTypeSelectBtn}
            >
              <span
                className={`w-5 h-5 group-hover:text-gray-200 ${
                  searchCtxMenuVisible ? 'text-gray-200' : 'text-gray-300'
                }`}
              >
                {searchType === SearchType.NL ? (
                  <NaturalLanguage />
                ) : (
                  <RegexIcon />
                )}
              </span>
              <span className={`w-5 h-5`}>
                {searchCtxMenuVisible ? (
                  <ChevronUpFilled />
                ) : (
                  <ChevronDownFilled />
                )}
              </span>
            </button>
          </ContextMenu>
        </span>
        {/*<span>*/}

        {/*</span>*/}

        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          id={id}
          name={name}
          type={type}
          disabled={disabled}
          ref={searchInputRef}
          onBlur={validate}
          autoComplete="off"
          spellCheck="false"
          className={`bg-transparent border-none focus:outline-none w-full group-focus-within:placeholder:text-gray-100 disabled:placeholder:text-gray-500 ${
            type === 'email' ? 'px-1' : 'pl-2.5'
          } transition-all duration-300 ease-in-bounce outline-none outline-0 pr-9`}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <ClearButton
            tabIndex={-1}
            onClick={() => {
              onChange({
                target: { value: '', name },
              } as ChangeEvent<HTMLInputElement>);
              searchInputRef.current?.focus();
            }}
            className={success ? 'group-focus-within:flex hidden' : 'flex'}
          />
        ) : null}
        {regex && searchType === SearchType.REGEX ? (
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
    </div>
  );
};

export default SearchTextInput;
