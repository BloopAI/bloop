import {
  ChangeEvent,
  MouseEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../../../components/Dropdown/Section';
import { StudioTemplateType } from '../../../../../types/api';
import SectionItem from '../../../../../components/Dropdown/Section/SectionItem';
import { CogIcon, TemplatesIcon } from '../../../../../icons';
import { UIContext } from '../../../../../context/uiContext';
import { ProjectSettingSections } from '../../../../../types/general';
import useKeyboardNavigation from '../../../../../hooks/useKeyboardNavigation';

type Props = {
  templates: StudioTemplateType[];
  onTemplateSelected: (t: string) => void;
  handleClose: () => void;
};

const TemplatesDropdown = ({
  templates,
  onTemplateSelected,
  handleClose,
}: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [templatesToShow, setTemplatesToShow] = useState(templates);
  const { setProjectSettingsOpen, setProjectSettingsSection } = useContext(
    UIContext.ProjectSettings,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!inputValue) {
      setTemplatesToShow(templates);
    } else {
      setTemplatesToShow(
        templates.filter((t) =>
          t.name.toLowerCase().includes(inputValue.toLowerCase()),
        ),
      );
    }
  }, [templates, inputValue]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleManage = useCallback(() => {
    setProjectSettingsSection(ProjectSettingSections.TEMPLATES);
    setProjectSettingsOpen(true);
  }, []);

  const noPropagate = useCallback((e: MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev < templatesToShow.length + 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : templatesToShow.length + 1,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIndex > 0 && focusedIndex - 1 < templatesToShow.length) {
          onTemplateSelected(templatesToShow[focusedIndex - 1]?.content);
        } else if (focusedIndex === templatesToShow.length + 1) {
          handleManage();
        }
        handleClose();
      }
    },
    [focusedIndex, handleManage, templatesToShow, onTemplateSelected],
  );
  useKeyboardNavigation(handleKeyEvent);

  useEffect(() => {
    if (focusedIndex === 0) {
      inputRef.current?.focus();
    }
  }, [focusedIndex]);

  return (
    <div>
      <DropdownSection borderBottom>
        <input
          className="w-full h-8 bg-transparent body-s px-2 outline-0 focus:outline-0 focus:outline-none placeholder:text-label-muted"
          value={inputValue}
          name={'search'}
          onChange={handleChange}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          placeholder={t('Search templates...')}
          autoFocus
          onClick={noPropagate}
          ref={inputRef}
        />
      </DropdownSection>
      <DropdownSection borderBottom>
        {templatesToShow.map((t, i) => (
          <SectionItem
            label={t.name}
            key={t.id}
            isFocused={focusedIndex === i + 1}
            onClick={() => onTemplateSelected(t.content)}
            icon={<TemplatesIcon sizeClassName="w-3.5 h-3.5" />}
          />
        ))}
      </DropdownSection>
      <DropdownSection>
        <SectionItem
          label={t('Manage templates')}
          icon={<CogIcon sizeClassName="w-3.5 h-3.5" />}
          onClick={handleManage}
          isFocused={focusedIndex === templatesToShow.length + 1}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(TemplatesDropdown);
