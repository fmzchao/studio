import { ThemeProps } from '@rjsf/core';
import { FieldTemplate } from './FieldTemplate';
import { ArrayFieldTemplate } from './ArrayFieldTemplate';
import { ArrayFieldItemTemplate } from './ArrayFieldItemTemplate';
import { BaseInputTemplate } from './BaseInputTemplate';
import { ObjectFieldTemplate } from './ObjectFieldTemplate';

export const Theme: ThemeProps = {
  templates: {
    FieldTemplate,
    ArrayFieldTemplate,
    ArrayFieldItemTemplate,
    BaseInputTemplate,
    ObjectFieldTemplate,
  },
  widgets: {
      // We might want to add custom widgets later for Select, Checkbox, etc. 
      // to ensure they match the compact style.
  }
};
