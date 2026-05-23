import fs from 'fs';
import path from 'path';

interface TemplateData {
  teacher_name: string;
  lms_code?: string;
  email: string;
  campus?: string;
  subject?: string;
  test_date: string;
  reason?: string;
  admin_name?: string;
  admin_email?: string;
  admin_note?: string;
  created_at?: string;
  updated_at?: string;
}

export function renderEmailTemplate(templateName: string, data: TemplateData): string {
  try {
    // Đọc file template
    const templatePath = path.join(process.cwd(), 'app', 'api', 'send-explanation-email', 'templates', `${templateName}.html`);
    let template = fs.readFileSync(templatePath, 'utf-8');
    
    // Format dates to Vietnamese locale
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('vi-VN');
    };
    
    const formatDateTime = (dateString: string) => {
      return new Date(dateString).toLocaleString('vi-VN');
    };
    
    // Replace template variables
    template = template.replace(/\{\{teacher_name\}\}/g, data.teacher_name || '');
    template = template.replace(/\{\{lms_code\}\}/g, data.lms_code || '');
    template = template.replace(/\{\{email\}\}/g, data.email || '');
    template = template.replace(/\{\{campus\}\}/g, data.campus || '');
    template = template.replace(/\{\{subject\}\}/g, data.subject || '');
    template = template.replace(/\{\{test_date\}\}/g, data.test_date ? formatDate(data.test_date) : '');
    template = template.replace(/\{\{reason\}\}/g, data.reason || '');
    template = template.replace(/\{\{admin_name\}\}/g, data.admin_name || 'Admin');
    template = template.replace(/\{\{admin_email\}\}/g, data.admin_email || '');
    template = template.replace(/\{\{created_at\}\}/g, data.created_at ? formatDateTime(data.created_at) : '');
    template = template.replace(/\{\{updated_at\}\}/g, data.updated_at ? formatDateTime(data.updated_at) : '');
    
    // Handle conditional admin_note
    if (data.admin_note) {
      template = template.replace(/\{\{#if admin_note\}\}/g, '');
      template = template.replace(/\{\{\/if\}\}/g, '');
      template = template.replace(/\{\{admin_note\}\}/g, data.admin_note);
    } else {
      // Remove the conditional block if admin_note is empty
      template = template.replace(/\{\{#if admin_note\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }
    
    return template;
  } catch (error) {
    console.error('Error rendering email template:', error);
    throw error;
  }
}
