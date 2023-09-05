import React, {
  ChangeEvent,
  FormEvent,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TextInput from '../../../components/TextInput';
import DialogText from '../../Onboarding/DialogText';
import { CodeStudioIcon } from '../../../icons';
import Button from '../../../components/Button';

type Props = {
  handleSubmit: (name: string) => void;
  initialValue?: string;
};

const AddCodeStudio = ({ handleSubmit, initialValue }: Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValue || '');

  useEffect(() => {
    if (initialValue) {
      setName(initialValue);
    }
  }, [initialValue]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit(name);
    },
    [handleSubmit, name],
  );
  return (
    <>
      <DialogText
        title={initialValue ? t('Rename code studio') : t('New code studio')}
        description={t(
          'Give a short descriptive name for your new code studio.',
        )}
      />
      <form className="flex flex-col overflow-auto" onSubmit={onSubmit}>
        <div className="flex flex-col gap-3">
          <TextInput
            value={name}
            autoFocus
            name="name"
            onChange={handleChange}
            variant="filled"
            placeholder={t('Name')}
            startIcon={<CodeStudioIcon />}
          />
        </div>
        <div className="flex flex-col gap-4 mt-8">
          <Button type="submit" variant="primary" disabled={!name}>
            <Trans>Submit</Trans>
          </Button>
        </div>
      </form>
    </>
  );
};

export default memo(AddCodeStudio);
