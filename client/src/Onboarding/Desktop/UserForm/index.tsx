import React, { Dispatch, SetStateAction, useContext, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BloopLogo, ChevronDownIcon } from '../../../icons';
import Button from '../../../components/Button';
import { Form } from '../../index';
import { EnvContext } from '../../../context/envContext';
import LanguageDropdown from '../../../Settings/Preferences/LanguageDropdown';
import { localesMap } from '../../../consts/general';
import Dropdown from '../../../components/Dropdown';
import { LocaleContext } from '../../../context/localeContext';
import Step2 from './Step2';
import Step1 from './Step1';

type Props = {
  form: Form;
  setForm: Dispatch<SetStateAction<Form>>;
  onContinue: () => void;
};

const UserForm = ({ form, setForm, onContinue }: Props) => {
  useTranslation();
  const { envConfig } = useContext(EnvContext);
  const [step, setStep] = useState(0);
  const { locale } = useContext(LocaleContext);

  return (
    <>
      <div className="w-full flex flex-col gap-3 text-center relative">
        <div className="absolute -top-32 left-0 right-0 flex justify-between">
          {step === 0 ? (
            <div />
          ) : (
            <Button variant="tertiary" size="small" onClick={() => setStep(0)}>
              <Trans>Back</Trans>
            </Button>
          )}
          <Dropdown
            DropdownComponent={LanguageDropdown}
            size="small"
            dropdownPlacement="bottom-end"
          >
            <Button variant="secondary">
              <span>{localesMap[locale].icon}</span>
              {localesMap[locale].name}
              <ChevronDownIcon sizeClassName="w-4 h-4" />
            </Button>
          </Dropdown>
        </div>
        <div className="flex flex-col gap-3 text-center relative">
          <div className="w-11 h-11 absolute left-1/2 -top-16 transform -translate-x-1/2">
            <BloopLogo />
          </div>
          <h4 className="text-label-title">
            <Trans>Setup bloop</Trans>
          </h4>
          {envConfig.credentials_upgrade && (
            <p className="text-sky/80 body-s-b border rounded-sm border-sky/30 p-1">
              <Trans>
                We’ve updated our auth service to make bloop more secure, please
                reauthorise your client with GitHub
              </Trans>
            </p>
          )}
          <p className="text-label-muted body-s-b">
            {step === 0 ? (
              <Trans>Let’s get you started with bloop!</Trans>
            ) : (
              <Trans>
                Please log into your GitHub account to complete setup, this
                helps us combat misuse.
              </Trans>
            )}
          </p>
        </div>
      </div>
      {step === 0 ? (
        <Step1 form={form} setForm={setForm} onContinue={() => setStep(1)} />
      ) : (
        <Step2 onContinue={onContinue} />
      )}
    </>
  );
};

export default UserForm;
