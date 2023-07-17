import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../Button';
import TextInput from '../../../TextInput';
import SettingsRow from '../../SettingsRow';
import SettingsText from '../../SettingsText';
import { EMAIL_REGEX } from '../../../../consts/validations';
import { saveUserData } from '../../../../services/api';
import { DeviceContext } from '../../../../context/deviceContext';
import {
  getJsonFromStorage,
  saveJsonToStorage,
  USER_DATA_FORM,
} from '../../../../services/storage';

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  emailError?: string;
};

const ProfileSettings = () => {
  const { t } = useTranslation();
  const { envConfig } = useContext(DeviceContext);
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
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
      emailError: e.target.name === 'email' ? '' : prev.emailError,
    }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (form.emailError) {
        return;
      }
      saveJsonToStorage(USER_DATA_FORM, form);
      saveUserData({
        email: form.email,
        first_name: form.firstName,
        last_name: form.lastName,
        unique_id: envConfig.tracking_id || '',
      });
    },
    [form, envConfig.tracking_id],
  );

  return (
    <form className="block">
      <SettingsRow>
        <SettingsText
          title={t('First and last name')}
          subtitle={t('Manage how you will be called in bloop')}
        />
        <div className="flex flex-1 flex-col gap-4">
          <TextInput
            value={form.firstName}
            onChange={onChange}
            name="firstName"
            label={t('First name')}
            variant="filled"
            placeholder={t('Your name')}
          />
          <TextInput
            value={form.lastName}
            onChange={onChange}
            name="lastName"
            label={t('Last name')}
            variant="filled"
            placeholder={t('Your last name')}
          />
        </div>
      </SettingsRow>
      <SettingsRow>
        <SettingsText
          title={t('Email')}
          subtitle={t('Used to sign in, syncing and product updates')}
        />
        <div className="flex-1 flex flex-col items-end">
          <TextInput
            value={form.email}
            onChange={onChange}
            name="email"
            label={t('Email')}
            variant="filled"
            placeholder={t('Your email address')}
            validate={() => {
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
      </SettingsRow>
      <Button
        size="small"
        className="absolute top-0 right-0"
        disabled={
          !!form.emailError ||
          (form.email === savedForm?.email &&
            form.firstName === savedForm?.firstName &&
            form.lastName === savedForm?.lastName)
        }
        onClick={handleSubmit}
      >
        <Trans>Save changes</Trans>
      </Button>
    </form>
  );
};

export default ProfileSettings;
