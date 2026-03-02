// Utility helper functions

/**
 * Format date to YYYY-MM-DD
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format datetime to readable string
 */
export const formatDateTime = (dateTime) => {
  if (!dateTime) return '';
  const d = new Date(dateTime);
  return d.toLocaleString();
};

/**
 * Get status color based on status string
 */
export const getStatusColor = (status) => {
  const statusLower = status?.toLowerCase() || '';
  
  if (statusLower.includes('approved') || statusLower.includes('active') || statusLower.includes('accepted')) {
    return '#4CAF50'; // Green
  }
  if (statusLower.includes('pending')) {
    return '#FF9800'; // Orange
  }
  if (statusLower.includes('rejected') || statusLower.includes('cancelled') || statusLower.includes('declined')) {
    return '#F44336'; // Red
  }
  if (statusLower.includes('inprogress') || statusLower.includes('assigned')) {
    return '#2196F3'; // Blue
  }
  if (statusLower.includes('resolved') || statusLower.includes('done')) {
    return '#9C27B0'; // Purple
  }
  
  return '#757575'; // Gray (default)
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

