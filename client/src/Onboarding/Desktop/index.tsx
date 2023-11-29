import React, { memo, useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NavBar from '../../components/Header';
import { DeviceContext } from '../../context/deviceContext';
import {
  getJsonFromStorage,
  saveJsonToStorage,
  USER_DATA_FORM,
} from '../../services/storage';
import { Form } from '../index';
import { saveUserData } from '../../services/api';
import Modal from '../../components/Modal';
import { EnvContext } from '../../context/envContext';
import FeaturesStep from './FeaturesStep';
import UserForm from './UserForm';

type Props = {
  closeOnboarding: () => void;
};

const Desktop = ({ closeOnboarding }: Props) => {
  const { t } = useTranslation();
  const [shouldShowPopup, setShouldShowPopup] = useState(false);
  const [form, setForm] = useState<Form>({
    firstName: '',
    lastName: '',
    email: '',
    emailError: null,
    ...getJsonFromStorage(USER_DATA_FORM),
  });
  const { os } = useContext(DeviceContext);
  const { envConfig } = useContext(EnvContext);

  const onSubmit = useCallback(() => {
    saveUserData({
      email: form.email,
      first_name: form.firstName,
      last_name: form.lastName,
      unique_id: envConfig.tracking_id || '',
    });
    saveJsonToStorage(USER_DATA_FORM, form);
    closeOnboarding();
    setTimeout(() => setShouldShowPopup(true), 1000);
  }, [form, envConfig.tracking_id]);

  return (
    <div className="fixed top-0 bottom-0 left-0 right-0 z-100 bg-bg-sub select-none">
      {os.type === 'Darwin' && (
        <div
          className="absolute top-0 left-0 right-0 h-14 bg-transparent"
          data-tauri-drag-region
        />
      )}
      <img
        src="/light.png"
        alt=""
        className="fixed -top-68 lg:-top-80 xl:-top-96 w-[90vw] lg:w-[80vw] xl:w-[69vw] right-0 pointer-events-none opacity-[0.16] z-50"
      />
      <div className="flex h-full justify-center mt-8">
        <div className="w-full lg:w-1/2 h-full flex justify-center">
          <div
            className={`w-[512px] h-full flex flex-col items-center justify-center px-13 gap-6`}
          >
            <UserForm form={form} setForm={setForm} onContinue={onSubmit} />
          </div>
        </div>
        <div
          className={`w-1/2 h-full hidden lg:flex justify-center items-center border-l border-bg-border relative 
        before:absolute before:top-0 before:bottom-0 before:left-0 before:right-0 before:bg-[url('/grainy-pattern.png')] 
        before:bg-repeat before:mix-blend-soft-light before:opacity-[0.14]`}
        >
          <div className="w-[585px]">
            <img className="onboarding-chats-img" alt={t('chats in bloop')} />
          </div>
        </div>
      </div>
      <Modal
        isVisible={shouldShowPopup}
        onClose={() => setShouldShowPopup(false)}
      >
        <FeaturesStep handleNext={() => setShouldShowPopup(false)} />
      </Modal>
    </div>
  );
};

export default memo(Desktop);
