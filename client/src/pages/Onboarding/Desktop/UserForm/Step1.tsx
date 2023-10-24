import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TextInput from '../../../../components/TextInput';
import { EMAIL_REGEX } from '../../../../consts/validations';
import Dropdown from '../../../../components/Dropdown/Normal';
import { themesMap } from '../../../../components/Settings/Preferences';
import { MenuItemType } from '../../../../types/general';
import { Theme } from '../../../../types';
import { previewTheme } from '../../../../utils';
import Button from '../../../../components/Button';
import { UIContext } from '../../../../context/uiContext';
import { Form } from '../../index';
import { DeviceContext } from '../../../../context/deviceContext';

type Props = {
  form: Form;
  setForm: Dispatch<SetStateAction<Form>>;
  onContinue: () => void;
};

const UserFormStep1 = ({ form, setForm, onContinue }: Props) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useContext(UIContext.Theme);
  const { openLink } = useContext(DeviceContext);
  const [showErrors, setShowErrors] = useState(false);

  const handleSubmit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (
        !form.firstName ||
        !form.lastName ||
        !form.email ||
        !!form.emailError ||
        !EMAIL_REGEX.test(form.email)
      ) {
        if (!EMAIL_REGEX.test(form.email)) {
          setForm((prev) => ({
            ...prev,
            emailError: t('Email is not valid'),
          }));
        }
        setShowErrors(true);
        return;
      }
      onContinue();
    },
    [form, onContinue],
  );

  return (
    <form
      className="flex flex-col gap-4 w-full"
      onSubmit={(e) => e.preventDefault()}
    >
      <TextInput
        value={form.firstName}
        name="firstName"
        placeholder={t('First name')}
        variant="filled"
        onChange={(e) =>
          setForm((prev) => ({ ...prev, firstName: e.target.value }))
        }
        autoFocus
        error={
          showErrors && !form.firstName
            ? t('First name is required')
            : undefined
        }
      />
      <TextInput
        value={form.lastName}
        name="lastName"
        placeholder={t('Last name')}
        variant="filled"
        onChange={(e) =>
          setForm((prev) => ({ ...prev, lastName: e.target.value }))
        }
        error={
          showErrors && !form.lastName ? t('Last name is required') : undefined
        }
      />
      <TextInput
        value={form.email}
        variant="filled"
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            email: e.target.value,
            emailError: null,
          }))
        }
        validate={() => {
          if (form.email && !EMAIL_REGEX.test(form.email)) {
            setForm((prev) => ({
              ...prev,
              emailError: t('Email is not valid'),
            }));
          }
        }}
        error={
          form.emailError ||
          (showErrors && !form.email ? t('Email is required') : undefined)
        }
        name="email"
        placeholder={t('Email address')}
      />
      <div className="flex flex-col w-full">
        <Dropdown
          btnHint={
            <span className="text-label-title">
              <Trans>Select color theme:</Trans>
            </span>
          }
          btnClassName="w-full border-transparent"
          items={Object.entries(themesMap).map(([key, name]) => ({
            type: MenuItemType.DEFAULT,
            text: t(name),
            onClick: () => setTheme(key as Theme),
            onMouseOver: () => previewTheme(key),
          }))}
          onClose={() => previewTheme(theme)}
          selected={{
            type: MenuItemType.DEFAULT,
            text: t(themesMap[theme]),
          }}
        />
      </div>
      <Button onClick={handleSubmit}>
        <Trans>Continue</Trans>
      </Button>
      <p className="caption text-label-base text-center">
        <Trans>By continuing you accept our</Trans>
        <br />
        <button
          onClick={() => openLink('https://bloop.ai/terms')}
          className="text-label-link"
        >
          <Trans>Terms & conditions</Trans>
        </button>{' '}
        <Trans>and </Trans>
        <button
          onClick={() => openLink('https://bloop.ai/privacy')}
          className="text-label-link"
        >
          <Trans>Privacy policy</Trans>
        </button>
      </p>
    </form>
  );
};

export default memo(UserFormStep1);
