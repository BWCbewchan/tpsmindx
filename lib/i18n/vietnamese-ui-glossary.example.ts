/**
 * Vietnamese UI Glossary Examples
 * 
 * Demonstrates how to use the Vietnamese UI glossary in components.
 */

import {
  vietnameseGlossary,
  getTranslation,
  hasTranslation,
  getCategoryTranslations,
} from './vietnamese-ui-glossary'

// Example 1: Direct access to translations
export function ButtonExamples() {
  return {
    submit: vietnameseGlossary.buttons.submit, // "Gửi"
    save: vietnameseGlossary.buttons.save, // "Lưu"
    delete: vietnameseGlossary.buttons.delete, // "Xóa"
    cancel: vietnameseGlossary.buttons.cancel, // "Hủy"
  }
}

// Example 2: Using getTranslation helper
export function FormFieldExamples() {
  return {
    email: getTranslation('formFields', 'email'), // "Địa chỉ email"
    password: getTranslation('formFields', 'password'), // "Mật khẩu"
    fullName: getTranslation('formFields', 'fullName'), // "Họ và tên"
    phoneNumber: getTranslation('formFields', 'phoneNumber'), // "Số điện thoại"
  }
}

// Example 3: Validation messages
export function ValidationExamples() {
  return {
    required: getTranslation('validation', 'required'), // "Bắt buộc"
    invalid: getTranslation('validation', 'invalid'), // "Không hợp lệ"
    tooShort: getTranslation('validation', 'tooShort'), // "Quá ngắn"
    tooLong: getTranslation('validation', 'tooLong'), // "Quá dài"
  }
}

// Example 4: Status messages
export function StatusExamples() {
  return {
    success: getTranslation('status', 'success'), // "Thành công"
    error: getTranslation('status', 'error'), // "Lỗi"
    loading: getTranslation('status', 'loading'), // "Đang tải"
    completed: getTranslation('status', 'completed'), // "Hoàn thành"
  }
}

// Example 5: Navigation items
export function NavigationExamples() {
  return {
    home: getTranslation('navigation', 'home'), // "Trang chủ"
    about: getTranslation('navigation', 'about'), // "Giới thiệu"
    contact: getTranslation('navigation', 'contact'), // "Liên hệ"
    dashboard: getTranslation('navigation', 'dashboard'), // "Bảng điều khiển"
  }
}

// Example 6: Time and date
export function TimeExamples() {
  return {
    today: getTranslation('time', 'today'), // "Hôm nay"
    yesterday: getTranslation('time', 'yesterday'), // "Hôm qua"
    tomorrow: getTranslation('time', 'tomorrow'), // "Ngày mai"
    justNow: getTranslation('time', 'justNow'), // "Vừa xong"
  }
}

// Example 7: Empty states
export function EmptyStateExamples() {
  return {
    noItemsFound: getTranslation('emptyStates', 'noItemsFound'), // "Không tìm thấy mục nào"
    noResults: getTranslation('emptyStates', 'noResults'), // "Không có kết quả"
    cartEmpty: getTranslation('emptyStates', 'cartEmpty'), // "Giỏ hàng của bạn đang trống"
    noNotifications: getTranslation('emptyStates', 'noNotifications'), // "Không có thông báo"
  }
}

// Example 8: Common phrases
export function CommonPhraseExamples() {
  return {
    pleaseWait: getTranslation('commonPhrases', 'pleaseWait'), // "Vui lòng đợi"
    tryAgain: getTranslation('commonPhrases', 'tryAgain'), // "Thử lại"
    learnMore: getTranslation('commonPhrases', 'learnMore'), // "Tìm hiểu thêm"
    areYouSure: getTranslation('commonPhrases', 'areYouSure'), // "Bạn có chắc chắn"
  }
}

// Example 9: Check if translation exists
export function CheckTranslationExample() {
  const hasSubmit = hasTranslation('buttons', 'submit') // true
  const hasInvalid = hasTranslation('buttons', 'invalid') // false
  
  return { hasSubmit, hasInvalid }
}

// Example 10: Get all translations for a category
export function GetAllButtonsExample() {
  const allButtons = getCategoryTranslations('buttons')
  
  // Returns all button translations:
  // { submit: "Gửi", save: "Lưu", delete: "Xóa", ... }
  
  return allButtons
}

// Example 11: Building a form with glossary
export function FormWithGlossary() {
  const form = {
    fields: {
      email: {
        label: vietnameseGlossary.formFields.email,
        placeholder: 'nhập email của bạn',
        validation: {
          required: vietnameseGlossary.validation.required,
          invalid: vietnameseGlossary.validation.invalidEmail,
        },
      },
      password: {
        label: vietnameseGlossary.formFields.password,
        placeholder: 'nhập mật khẩu',
        validation: {
          required: vietnameseGlossary.validation.required,
          tooShort: vietnameseGlossary.validation.tooShort,
        },
      },
    },
    buttons: {
      submit: vietnameseGlossary.buttons.submit,
      cancel: vietnameseGlossary.buttons.cancel,
    },
  }
  
  return form
}

// Example 12: Building error messages
export function ErrorMessageBuilder(field: string, errorType: string) {
  const fieldName = getTranslation('formFields', field)
  const errorMessage = getTranslation('validation', errorType)
  
  // Combine field name and error message
  return `${fieldName} ${errorMessage.toLowerCase()}`
  // Example: "Địa chỉ email bắt buộc"
}

// Example 13: Status badge component
export function StatusBadgeExample(status: 'success' | 'error' | 'loading' | 'pending') {
  return {
    text: getTranslation('status', status),
    color: {
      success: 'green',
      error: 'red',
      loading: 'blue',
      pending: 'yellow',
    }[status],
  }
}

// Example 14: Navigation menu builder
export function NavigationMenuExample() {
  return [
    { label: vietnameseGlossary.navigation.home, href: '/' },
    { label: vietnameseGlossary.navigation.about, href: '/about' },
    { label: vietnameseGlossary.navigation.services, href: '/services' },
    { label: vietnameseGlossary.navigation.contact, href: '/contact' },
  ]
}

// Example 15: Action buttons builder
export function ActionButtonsExample() {
  return {
    primary: [
      { label: vietnameseGlossary.buttons.save, action: 'save' },
      { label: vietnameseGlossary.buttons.submit, action: 'submit' },
    ],
    secondary: [
      { label: vietnameseGlossary.buttons.cancel, action: 'cancel' },
      { label: vietnameseGlossary.buttons.reset, action: 'reset' },
    ],
    destructive: [
      { label: vietnameseGlossary.buttons.delete, action: 'delete' },
      { label: vietnameseGlossary.buttons.remove, action: 'remove' },
    ],
  }
}

// Example 16: Complete glossary statistics
export function GlossaryStatistics() {
  return {
    buttons: Object.keys(vietnameseGlossary.buttons).length, // 50+
    formFields: Object.keys(vietnameseGlossary.formFields).length, // 40+
    validation: Object.keys(vietnameseGlossary.validation).length, // 30+
    status: Object.keys(vietnameseGlossary.status).length, // 25+
    navigation: Object.keys(vietnameseGlossary.navigation).length, // 25+
    time: Object.keys(vietnameseGlossary.time).length, // 30+
    emptyStates: Object.keys(vietnameseGlossary.emptyStates).length, // 15+
    commonPhrases: Object.keys(vietnameseGlossary.commonPhrases).length, // 30+
    actions: Object.keys(vietnameseGlossary.actions).length, // 20+
    dataDisplay: Object.keys(vietnameseGlossary.dataDisplay).length, // 15+
    total: Object.values(vietnameseGlossary).reduce(
      (sum, category) => sum + Object.keys(category).length,
      0
    ), // 280+ total translations
  }
}
