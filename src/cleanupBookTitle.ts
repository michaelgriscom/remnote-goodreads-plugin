
export function cleanupBookTitle(title: string): string {
    // Remove text after colon (typically subtitle)
    let cleanTitle = title.split(':')[0];
  
    // Remove series information in parentheses
    cleanTitle = cleanTitle.replace(/\s*\([^)]*\)\s*$/, '');
  
    // Remove edition information like "1st Edition", "Revised Edition", etc.
    cleanTitle = cleanTitle.replace(/\s*(\d+(?:st|nd|rd|th)\s+Edition|Revised Edition|Special Edition)\s*$/i, '');
  
    // Remove trailing spaces
    cleanTitle = cleanTitle.trim();
  
    return cleanTitle;
  }