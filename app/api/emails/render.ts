import fs from 'fs';
import path from 'path';

export function renderTemplate(
  templateName: string,
  vars: Record<string, string | undefined>,
): string {
  const templatePath = path.join(
    process.cwd(),
    'app',
    'api',
    'emails',
    'templates',
    `${templateName}.html`,
  );
  let html = fs.readFileSync(templatePath, 'utf-8');

  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value ?? '');
  }

  html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, varName, block) => {
    return vars[varName] ? block.replace(new RegExp(`{{${varName}}}`, 'g'), vars[varName] ?? '') : '';
  });

  return html;
}
