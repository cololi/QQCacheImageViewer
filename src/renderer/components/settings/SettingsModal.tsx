/**
 * 设置模态框组件
 * 精简版 - 仅保留核心路径和扫描设置
 */

import React, { useState } from 'react';
import { Modal, Form, Input, Button, message, Popconfirm } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  selectSettings,
  selectPreferences,
  saveSettings,
  resetToDefaults,
} from '../../store/slices/settingsSlice';
import { RootState, AppDispatch } from '../../store/store';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((state: RootState) => selectSettings(state));
  const preferences = useSelector((state: RootState) => selectPreferences(state));
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 当模态框打开时设置表单值
  React.useEffect(() => {
    if (open && preferences) {
      form.setFieldsValue(preferences);
    }
  }, [open, preferences, form]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // Merge over existing preferences — the form only holds a subset of fields
      // (e.g. defaultExportPath), so replacing wholesale would wipe theme etc.
      const result = await dispatch(
        saveSettings({
          ...settings,
          preferences: { ...preferences, ...values },
        }),
      );

      if (result.type.endsWith('/fulfilled')) {
        message.success(t('settings.saved', '设置已保存'));
        onClose();
      } else {
        message.error(t('settings.error', '保存设置失败'));
      }
    } catch (error) {
      message.error(t('settings.error', '保存设置失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const result = await dispatch(resetToDefaults());

      if (result.type.endsWith('/fulfilled')) {
        message.success(t('settings.resetSuccess', '已重置为默认设置'));
        form.resetFields();
      } else {
        message.error(t('settings.error', '重置失败'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('settings.title', '应用设置')}
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Popconfirm
          key="reset"
          title={t('settings.resetToDefaults', '重置为默认设置?')}
          description={t('settings.confirmReset', '确定要丢失所有当前设置吗?')}
          onConfirm={handleReset}
          okText={t('common.ok', '确定')}
          cancelText={t('common.cancel', '取消')}
        >
          <Button danger>{t('common.reset', '重置')}</Button>
        </Popconfirm>,
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel', '取消')}
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSave}>
          {t('common.save', '保存')}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" className="max-h-[400px] overflow-y-auto pr-3">
        <Form.Item
          name="defaultExportPath"
          label={t('settings.defaultExportPath', '默认导出路径')}
          extra="图片导出或保存时的默认文件夹"
        >
          <Input placeholder="输入默认导出路径" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SettingsModal;
