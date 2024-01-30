import React, {
  ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TextInput from '../../components/TextInput';
import Button from '../../components/Button';
import { getTemplates, patchTemplate, postTemplate } from '../../services/api';
import { PlusSignIcon } from '../../icons';
import { StudioTemplateType } from '../../types/api';
import ArrowLeft from '../../icons/ArrowLeft';
import TemplateItem from './TemplateItem';

type Props = {};

const Templates = ({}: Props) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<StudioTemplateType[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState('');
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');

  const refetchTemplates = useCallback(() => {
    getTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    refetchTemplates();
  }, []);

  const handleAddNew = useCallback(() => {
    setIsEditMode(true);
    setTemplateToEdit('');
  }, []);

  const handleEdit = useCallback((temp: StudioTemplateType) => {
    setIsEditMode(true);
    setTemplateToEdit(temp.id);
    setNewName(temp.name);
    setNewContent(temp.content);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditMode(false);
    setTemplateToEdit('');
    setNewName('');
    setNewContent('');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!templateToEdit) {
      await postTemplate(newName, newContent);
    } else {
      await patchTemplate(templateToEdit, {
        name: newName,
        content: newContent,
      });
    }
    refetchTemplates();
    handleCancel();
  }, [newContent, newName, templateToEdit, handleCancel]);

  const handleChangeName = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
  }, []);

  const handleChangeContent = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setNewContent(e.target.value);
    },
    [],
  );

  return (
    <div className="w-[36.25rem] flex flex-col flex-2 gap-8 items-start">
      {isEditMode ? (
        <>
          <Button variant="secondary" onClick={handleCancel}>
            <ArrowLeft sizeClassName="w-4.5 h-4.5" />
            <Trans>All templates</Trans>
          </Button>
          <p className="select-none title-m">
            <Trans>{templateToEdit ? 'Edit' : 'Create'} template</Trans>
          </p>
          <hr className="border-bg-divider w-full" />
          <TextInput
            value={newName}
            name={'name'}
            onChange={handleChangeName}
            label={t('Template title')}
            placeholder={t('Give your template a title')}
          />
          <TextInput
            value={newContent}
            name={'content'}
            onChange={handleChangeContent}
            label={t('Prompt')}
            placeholder={t('Write your prompt...')}
            multiline
          />
          <div className="w-full flex items-center justify-end gap-3">
            <Button variant="tertiary" onClick={handleCancel}>
              <Trans>Cancel</Trans>
            </Button>
            <Button onClick={handleSubmit}>
              <Trans>Save changes</Trans>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 ">
            <p className="body-m text-label-title">
              <Trans>Studio</Trans>
            </p>
            <p className="body-s-b text-label-muted">
              <Trans>Manage your studio settings.</Trans>
            </p>
          </div>
          <hr className="border-bg-divider w-full" />
          <div className="w-full flex items-start justify-between gap-2">
            <div className="flex flex-col gap-3 ">
              <p className="body-m text-label-title">
                <Trans>Prompt templates</Trans>
              </p>
              <p className="body-s-b text-label-muted">
                <Trans>
                  Write studio prompts faster with pre-written templates
                </Trans>
              </p>
            </div>
            <Button onClick={handleAddNew}>
              <PlusSignIcon sizeClassName="w-4.5 h-4.5" />
              <Trans>New</Trans>
            </Button>
          </div>
          <div className="w-full flex flex-col rounded-md border border-bg-border overflow-hidden">
            {templates.map((t) => (
              <TemplateItem
                {...t}
                key={t.id}
                refetchTemplates={refetchTemplates}
                handleEdit={handleEdit}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default memo(Templates);
