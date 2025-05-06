/**
 * Safely converts an ObjectId to a string, handling null/undefined values
 * @param {Object|string|null} objectId - Mongoose ObjectId, string ID, or null
 * @returns {string|null} String representation of the ID or null
 */
export const safeObjectIdToString = (objectId) => {
  if (!objectId) return null;
  
  // If it's already a string, return it
  if (typeof objectId === 'string') return objectId;
  
  // If it's an object with _id property (populated document)
  if (objectId._id) return objectId._id.toString();
  
  // If it's a Mongoose ObjectId
  if (objectId.toString) return objectId.toString();
  
  // Fallback
  return null;
};