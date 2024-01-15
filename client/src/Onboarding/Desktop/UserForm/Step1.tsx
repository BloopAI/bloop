import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TextInput from '../../../components/TextInput';
import { EMAIL_REGEX } from '../../../consts/validations';
import { themesMap } from '../../../consts/general';
import Button from '../../../components/Button';
import { UIContext } from '../../../context/uiContext';
import { Form } from '../../index';
import { DeviceContext } from '../../../context/deviceContext';
import Dropdown from '../../../components/Dropdown';
import ThemeDropdown from '../../../Settings/Preferences/ThemeDropdown';
import { themeIconsMap } from '../../../Settings/Preferences';
import { ChevronDownIcon } from '../../../icons';

type Props = {
  form: Form;
  setForm: Dispatch<SetStateAction<Form>>;
  onContinue: () => void;
};

const UserFormStep1 = ({ form, setForm, onContinue }: Props) => {
  const { t } = useTranslation();
  const { theme } = useContext(UIContext.Theme);
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
        onChange={(e) =>
          setForm((prev) => ({ ...prev, lastName: e.target.value }))
        }
        error={
          showErrors && !form.lastName ? t('Last name is required') : undefined
        }
      />
      <TextInput
        value={form.email}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            email: e.target.value,
            emailError: null,
          }))
        }
        onBlur={() => {
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
      <div className="flex items-center justify-between w-full">
        <span className="text-label-title body-s-b">
          <Trans>Select color theme:</Trans>
        </span>
        <Dropdown
          DropdownComponent={ThemeDropdown}
          size="small"
          dropdownPlacement="bottom-end"
        >
          <Button variant="secondary">
            {themeIconsMap[theme]}
            <Trans>{themesMap[theme]}</Trans>
            <ChevronDownIcon sizeClassName="w-4 h-4" />
          </Button>
        </Dropdown>
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
