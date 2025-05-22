import jwt from 'jsonwebtoken';

const authMiddleware = (roles = []) => (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized - No Token Provided" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (process.env.NODE_ENV !== 'production') {
            console.log('Decoded JWT:', decoded); // debugging
        }
        if (roles.length && !roles.includes(decoded.role)) {
            return res.status(403).json({ message: "Forbidden - Insufficient Role" });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('❌ Auth Error:', error.message);
        res.status(401).json({ message: "Invalid Token" });
    }
};

export default authMiddleware;