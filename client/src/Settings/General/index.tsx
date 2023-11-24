import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
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
import Dropdown from '../../components/Dropdown';
import Button from '../../components/Button';
import { ChevronDownIcon, RunIcon, WalkIcon } from '../../icons';
import { ProjectContext } from '../../context/projectContext';
import AnswerSpeedDropdown from './AnswerSpeedDropdown';

type Props = {};

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  emailError?: string;
};

const GeneralSettings = ({}: Props) => {
  const { t } = useTranslation();
  const { preferredAnswerSpeed } = useContext(ProjectContext.AnswerSpeed);
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
      <hr className="border-bg-divider my-8" />
      <div className="flex items-start gap-8 w-full justify-between">
        <div className="flex flex-col gap-2">
          <p className="body-base-b text-label-title">
            <Trans>Answer speed</Trans>
          </p>
          <p className="body-s-b text-label-muted">
            <Trans>How fast or precise bloop&apos;s answers will be.</Trans>
          </p>
        </div>
        <Dropdown
          DropdownComponent={AnswerSpeedDropdown}
          dropdownPlacement="bottom-end"
          size="auto"
        >
          <Button variant="secondary">
            {preferredAnswerSpeed === 'fast' ? (
              <RunIcon raw sizeClassName="w-4.5 h-4.5" />
            ) : (
              <WalkIcon raw sizeClassName="w-4.5 h-4.5" />
            )}
            {preferredAnswerSpeed.charAt(0).toUpperCase() +
              preferredAnswerSpeed.slice(1)}
            <ChevronDownIcon sizeClassName="w-4 h-4" />
          </Button>
        </Dropdown>
      </div>
    </div>
  );
};

export default memo(GeneralSettings);
