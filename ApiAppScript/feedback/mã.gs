function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);
    const timestamp = data.timestamp || new Date().toISOString();
    
    // Check if this is feedback or analytics based on presence of rating field
    if (data.rating !== undefined) {
      // This is FEEDBACK
      const feedbackSheet = ss.getSheetByName('Feedback');
      const userCode = data.userCode || 'anonymous';
      const rating = data.rating || 0;
      const comment = data.comment || '';
      const feature = data.feature || '';
      
      feedbackSheet.appendRow([
        timestamp,
        userCode,
        rating,
        comment,
        feature
      ]);
      
      return ContentService.createTextOutput(
        JSON.stringify({ 
          success: true, 
          message: 'Feedback received' 
        })
      ).setMimeType(ContentService.MimeType.JSON);
      
    } else {
      // This is ANALYTICS
      const logsSheet = ss.getSheetByName('Logs');
      const action = data.action || 'unknown'; // 'visit' or 'search'
      const searchCode = data.searchCode || '';
      
      logsSheet.appendRow([
        timestamp,
        action,
        searchCode
      ]);
      
      return ContentService.createTextOutput(
        JSON.stringify({ 
          success: true, 
          message: 'Analytics tracked' 
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: false, 
        error: error.toString() 
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logsSheet = ss.getSheetByName('Logs');
    
    const data = logsSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Count visits
    const totalVisits = rows.filter(row => row[1] === 'visit').length;
    
    // Count searches
    const totalSearches = rows.filter(row => row[1] === 'search').length;
    
    // Get all search codes
    const searchRows = rows.filter(row => row[1] === 'search' && row[2]);
    const searchCodes = searchRows.map(row => row[2]);
    
    // Count unique searches
    const uniqueSearches = new Set(searchCodes).size;
    
    // Count top searches
    const searchCounts = {};
    searchCodes.forEach(code => {
      searchCounts[code] = (searchCounts[code] || 0) + 1;
    });
    
    const topSearches = Object.entries(searchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));
    
    // Get recent searches (last 10)
    const recentSearches = searchRows
      .slice(-10)
      .reverse()
      .map(row => ({
        code: row[2],
        timestamp: row[0]
      }));
    
    return ContentService.createTextOutput(
      JSON.stringify({
        totalVisits,
        totalSearches,
        uniqueSearches,
        topSearches,
        recentSearches
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ 
        error: error.toString() 
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}