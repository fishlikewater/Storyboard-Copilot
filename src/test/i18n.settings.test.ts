import { describe, expect, it } from 'vitest';

import en from '@/i18n/locales/en.json';
import zh from '@/i18n/locales/zh.json';

describe('settings locale parity', () => {
  it('contains supplier management keys in both locales', () => {
    expect(zh.settings.providers).toBeTypeOf('string');
    expect(zh.settings.suppliers).toBeTypeOf('string');
    expect(zh.settings.addSupplier).toBeTypeOf('string');
    expect(zh.settings.editSupplier).toBeTypeOf('string');
    expect(zh.settings.deleteSupplierTitle).toBeTypeOf('string');
    expect(zh.settings.deleteSupplierConfirm).toContain('{{name}}');
    expect(zh.settings.confirmDeleteSupplier).toBeTypeOf('string');
    expect(zh.settings.customProviderNoEnabledModels).toBeTypeOf('string');

    expect(en.settings.providers).toBeTypeOf('string');
    expect(en.settings.suppliers).toBeTypeOf('string');
    expect(en.settings.addSupplier).toBeTypeOf('string');
    expect(en.settings.editSupplier).toBeTypeOf('string');
    expect(en.settings.deleteSupplierTitle).toBeTypeOf('string');
    expect(en.settings.deleteSupplierConfirm).toContain('{{name}}');
    expect(en.settings.confirmDeleteSupplier).toBeTypeOf('string');
    expect(en.settings.customProviderNoEnabledModels).toBeTypeOf('string');
  });
});
