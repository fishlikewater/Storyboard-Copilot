import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiModal, UiPanel } from '@/components/ui';
import {
  createPromptTemplateDraft,
  type PromptTemplateConfig,
} from '@/stores/promptTemplateConfig';
import { useSettingsStore } from '@/stores/settingsStore';

import { DeletePromptTemplateDialog } from './DeletePromptTemplateDialog';
import { PromptTemplateEditorDialog } from './PromptTemplateEditorDialog';

interface PromptManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function summarizePromptContent(content: string): string {
  return content.replace(/\s+/gu, ' ').trim();
}

export function PromptManagementDialog({ isOpen, onClose }: PromptManagementDialogProps) {
  const { t } = useTranslation();
  const promptTemplates = useSettingsStore((state) => state.promptTemplates);
  const setPromptTemplates = useSettingsStore((state) => state.setPromptTemplates);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplateConfig | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<PromptTemplateConfig | null>(null);

  const handleCreate = () => {
    setEditorMode('create');
    setEditingTemplate(createPromptTemplateDraft());
  };

  const handleEdit = (template: PromptTemplateConfig) => {
    setEditorMode('edit');
    setEditingTemplate(template);
  };

  const handleSaveTemplate = (nextTemplate: PromptTemplateConfig) => {
    const exists = promptTemplates.some((template) => template.id === nextTemplate.id);
    const nextTemplates = exists
      ? promptTemplates.map((template) =>
          template.id === nextTemplate.id ? nextTemplate : template
        )
      : [...promptTemplates, nextTemplate];

    setPromptTemplates(nextTemplates);
  };

  const handleDeleteTemplate = () => {
    if (!deletingTemplate) {
      return;
    }

    setPromptTemplates(
      promptTemplates.filter((template) => template.id !== deletingTemplate.id)
    );
    setDeletingTemplate(null);
  };

  return (
    <>
      <UiModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('promptTemplates.title')}
        widthClassName="w-[min(92vw,860px)]"
        footer={(
          <UiButton type="button" variant="ghost" onClick={onClose}>
            {t('common.close')}
          </UiButton>
        )}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-muted">{t('promptTemplates.description')}</p>
            <UiButton type="button" size="sm" onClick={handleCreate}>
              {t('promptTemplates.add')}
            </UiButton>
          </div>

          {promptTemplates.length === 0 ? (
            <UiPanel className="rounded-xl border-dashed p-8 text-center text-sm text-text-muted">
              {t('promptTemplates.empty')}
            </UiPanel>
          ) : (
            <div className="space-y-3">
              {promptTemplates.map((template) => (
                <UiPanel key={template.id} className="rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text-dark">{template.title}</div>
                      <div className="mt-2 text-sm text-text-muted">
                        {summarizePromptContent(template.content)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <UiButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(template)}
                      >
                        {t('common.edit')}
                      </UiButton>
                      <UiButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingTemplate(template)}
                      >
                        {t('common.delete')}
                      </UiButton>
                    </div>
                  </div>
                </UiPanel>
              ))}
            </div>
          )}
        </div>
      </UiModal>

      <PromptTemplateEditorDialog
        isOpen={Boolean(editingTemplate)}
        mode={editorMode}
        template={editingTemplate}
        existingTemplates={promptTemplates}
        onClose={() => setEditingTemplate(null)}
        onSave={handleSaveTemplate}
      />
      <DeletePromptTemplateDialog
        isOpen={Boolean(deletingTemplate)}
        template={deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={handleDeleteTemplate}
      />
    </>
  );
}
