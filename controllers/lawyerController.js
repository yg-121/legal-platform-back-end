// Get all lawyers with search functionality
exports.getAllLawyers = async (req, res) => {
  try {
    const { search, specialization, location, minRating } = req.query;
    
    // Build query object
    const query = { role: "lawyer" };
    
    // Add search filters if provided
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (specialization) {
      query.specialization = { $regex: specialization, $options: 'i' };
    }
    
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    
    if (minRating) {
      query.averageRating = { $gte: parseFloat(minRating) };
    }
    
    // Execute query
    const lawyers = await User.find(query)
      .select('-password')
      .sort({ averageRating: -1 });
    
    res.status(200).json({
      success: true,
      count: lawyers.length,
      lawyers
    });
  } catch (error) {
    console.error('Error getting lawyers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};