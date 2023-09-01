import React, {
  ChangeEvent,
  FormEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { MoreHorizontal, Pen, Template, TrashCanFilled } from '../../../icons';
import Button from '../../../components/Button';
import { DropdownWithIcon } from '../../../components/Dropdown';
import { MenuItemType } from '../../../types/general';
import { ContextMenuItem } from '../../../components/ContextMenu';
import MarkdownWithCode from '../../../components/MarkdownWithCode';
import {
  deleteTemplate,
  patchTemplate,
  postTemplate,
} from '../../../services/api';
import { StudioContext } from '../../../context/studioContext';

type Props = {
  id: string;
  name: string;
  content: string;
  refetchTemplates: () => void;
};

const TemplateCard = ({ id, name, content, refetchTemplates }: Props) => {
  const { t } = useTranslation();
  const { setInputValue } = useContext(StudioContext.Setters);
  const [isEditing, setIsEditing] = useState(id === 'new');
  const [form, setForm] = useState({ name, content });
  const ref = useRef<HTMLTextAreaElement>(null);
  const cloneRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setForm({ name, content });
  }, [content, name]);

  const dropdownItems = useMemo(() => {
    return [
      {
        type: MenuItemType.DEFAULT,
        text: t('Edit'),
        icon: <Pen raw sizeClassName="w-3.5 h-3.5" />,
        onClick: () => {
          setIsEditing(true);
          setTimeout(() => {
            if (ref.current) {
              ref.current.focus();
              // set caret at the end of textarea
              ref.current.selectionStart = content.length;
              ref.current.selectionEnd = content.length;
            }
          }, 100);
        },
      },
      {
        type: MenuItemType.DEFAULT,
        text: t('Delete'),
        icon: <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />,
        onClick: () => deleteTemplate(id).then(refetchTemplates),
      },
    ] as ContextMenuItem[];
  }, [content, id, refetchTemplates, t]);

  useEffect(() => {
    if (ref.current && cloneRef.current) {
      cloneRef.current.style.height = '22px';
      const scrollHeight = cloneRef.current.scrollHeight;

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      ref.current.style.height =
        Math.min(Math.max(scrollHeight, 22), 300) + 'px';
    }
  }, [content, isEditing]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    [],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setIsEditing(false);
      if (id === 'new') {
        postTemplate(form.name, form.content).then(refetchTemplates);
      } else {
        patchTemplate(id, form).then(refetchTemplates);
      }
    },
    [form, id, refetchTemplates],
  );

  return (
    <div
      className={`flex flex-col gap-3 p-3 rounded-6 border ${
        isEditing
          ? 'border-bg-main shadow-medium bg-bg-base'
          : 'border-bg-border  hover:border-bg-border-hover hover:bg-bg-base'
      } transition-all duration-150 ease-in-out`}
    >
      <div className="flex items-center gap-2">
        <Template />
        <input
          disabled={!isEditing}
          value={form.name}
          name="name"
          onChange={handleChange}
          autoFocus={id === 'new'}
          className="body-s-strong text-label-title w-full bg-transparent outline-none focus:outline-0 placeholder:text-label-base"
        />
        {isEditing ? (
          <>
            <Button
              key="cancel"
              variant="secondary"
              size="tiny"
              onClick={() => {
                setIsEditing(false);
                setForm({ name, content });
              }}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              key="submit"
              size="tiny"
              onClick={onSubmit}
              disabled={!form.name || !form.content}
            >
              <Trans>Save changes</Trans>
            </Button>
          </>
        ) : (
          <>
            <Button
              size="tiny"
              key="use"
              onClick={() => setInputValue(content)}
            >
              <Trans>Use</Trans>
            </Button>
            <DropdownWithIcon
              items={dropdownItems}
              btnOnlyIcon
              icon={<MoreHorizontal sizeClassName="w-3.5 h-3.5" />}
              noChevron
              btnSize="tiny"
              dropdownBtnClassName="flex-shrink-0"
              appendTo={document.body}
              size="small"
            />
          </>
        )}
      </div>
      <div className="pl-7 body-s relative code-studio-md">
        {isEditing ? (
          <>
            <textarea
              value={form.content}
              onChange={handleChange}
              name="content"
              className={`w-full bg-transparent outline-none focus:outline-0 resize-none body-s placeholder:text-label-base`}
              rows={1}
              autoComplete="off"
              spellCheck="false"
              ref={ref}
            />
            <textarea
              className={`resize-none body-s absolute top-0 left-0 right-0 -z-10`}
              value={content}
              disabled
              rows={1}
              ref={cloneRef}
            />
          </>
        ) : (
          <MarkdownWithCode
            markdown={content.replaceAll('\\n', '\n\n')}
            isCodeStudio
          />
        )}
      </div>
    </div>
  );
};

export default memo(TemplateCard);
