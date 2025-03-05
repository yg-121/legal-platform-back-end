import Case from '../models/Case.js';

export const createCase = async (req, res) => {
    try {
        const { description } = req.body;
        if (!description) return res.status(400).json({ message: "Description is required" });

        const newCase = new Case({ client: req.user.id, description });
        await newCase.save();

        res.status(201).json(newCase);
    } catch (error) {
        console.error('❌ Case Creation Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getAllCases = async (req, res) => {
    try {
        const cases = await Case.find().populate('client', 'username email');
        res.json(cases);
    } catch (error) {
        console.error('❌ Fetch Cases Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getClientCases = async (req, res) => {
    try {
        const cases = await Case.find({ client: req.user.id });
        res.json(cases);
    } catch (error) {
        console.error('❌ Fetch Client Cases Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};