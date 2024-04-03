import React, {
  ChangeEvent,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TextInput from '../../components/TextInput';
import {
  getJsonFromStorage,
  saveJsonToStorage,
  USER_DATA_FORM,
} from '../../services/storage';
import { EMAIL_REGEX } from '../../consts/validations';

type Props = {};

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  emailError?: string;
};

const GeneralSettings = ({}: Props) => {
  const { t } = useTranslation();
  const savedForm: Form | null = useMemo(
    () => getJsonFromStorage(USER_DATA_FORM),
    [],
  );
  const [form, setForm] = useState<Form>({
    firstName: savedForm?.firstName || '',
    lastName: savedForm?.lastName || '',
    email: savedForm?.email || '',
    emailError: '',
  });

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => {
      const newForm = {
        ...prev,
        [e.target.name]: e.target.value,
        emailError: e.target.name === 'email' ? '' : prev.emailError,
      };
      saveJsonToStorage(USER_DATA_FORM, newForm);
      return newForm;
    });
  }, []);

  return (
    <div className="w-[36.25rem] flex flex-col flex-2">
      <div className="flex flex-col gap-3 ">
        <p className="body-m text-label-title">
          <Trans>General</Trans>
        </p>
        <p className="body-s-b text-label-muted">
          <Trans>Manage your general account settings</Trans>
        </p>
      </div>
      <hr className="border-bg-divider my-8" />
      <div className="flex flex-col gap-5 max-w-[25rem]">
        <TextInput
          value={form.firstName}
          name={'firstName'}
          onChange={onChange}
          label={t('First name')}
        />
        <TextInput
          value={form.lastName}
          name={'lastName'}
          onChange={onChange}
          label={t('Last name')}
        />
      </div>
      <hr className="border-bg-divider my-8" />
      <div className="flex flex-col gap-5 max-w-[25rem]">
        <TextInput
          value={form.email}
          name={'email'}
          onChange={onChange}
          label={t('Email address')}
          onBlur={() => {
            if (!EMAIL_REGEX.test(form.email)) {
              setForm((prev) => ({
                ...prev,
                emailError: t('Email is not valid'),
              }));
            }
          }}
          error={form.emailError}
        />
      </div>
    </div>
  );
};

export default memo(GeneralSettings);
