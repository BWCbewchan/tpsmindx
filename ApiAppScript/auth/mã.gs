/**
 * Apps Script để kiểm tra quyền admin
 * Deploy as Web App với Execute as: Me, Who has access: Anyone
 */

function doGet(e) {
  try {
    const email = e.parameter.email;
    
    if (!email) {
      return ContentService.createTextOutput(
        JSON.stringify({ 
          error: 'Email parameter is required' 
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const adminSheet = ss.getSheetByName('Admins');
    
    if (!adminSheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ 
          error: 'Admins sheet not found',
          isAdmin: false
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Lấy tất cả email admin từ cột A (bỏ qua header row 1)
    const adminEmails = adminSheet.getRange(2, 1, adminSheet.getLastRow() - 1, 1).getValues();
    
    // Kiểm tra email có trong danh sách admin không (case-insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    const isAdmin = adminEmails.some(row => {
      const adminEmail = String(row[0]).toLowerCase().trim();
      return adminEmail === normalizedEmail;
    });
    
    // Log việc kiểm tra
    const logSheet = ss.getSheetByName('AuthLogs');
    if (logSheet) {
      logSheet.appendRow([
        new Date().toISOString(),
        email,
        isAdmin ? 'ADMIN' : 'USER',
        'Check admin permission'
      ]);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: true,
        email: email,
        isAdmin: isAdmin,
        message: isAdmin ? 'Admin verified' : 'Regular user'
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ 
        error: error.toString(),
        isAdmin: false
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hàm test để thêm admin mẫu
 */
function setupAdminSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Tạo sheet Admins nếu chưa có
  let adminSheet = ss.getSheetByName('Admins');
  if (!adminSheet) {
    adminSheet = ss.insertSheet('Admins');
    adminSheet.appendRow(['Email', 'Name', 'Role', 'Added Date']);
    
    // Thêm admin mẫu
    adminSheet.appendRow([
      'admin@mindx.com.vn',
      'Admin User',
      'Super Admin',
      new Date().toISOString()
    ]);
  }
  
  // Tạo sheet AuthLogs nếu chưa có
  let logSheet = ss.getSheetByName('AuthLogs');
  if (!logSheet) {
    logSheet = ss.insertSheet('AuthLogs');
    logSheet.appendRow(['Timestamp', 'Email', 'Status', 'Action']);
  }
  
  Logger.log('Admin sheet setup complete!');
}
