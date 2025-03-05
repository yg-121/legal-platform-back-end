import Bid from '../models/Bid.js';
import Case from '../models/Case.js';
import { sendNotification } from '../utils/notify.js';


export const placeBid = async (req, res) => {
    try {
        const { caseId, bidAmount } = req.body;
        if (!caseId || !bidAmount) return res.status(400).json({ message: "Case ID and bid amount are required" });

        const caseExists = await Case.findById(caseId);
        if (!caseExists) return res.status(404).json({ message: "Case not found" });

        const newBid = new Bid({ case: caseId, lawyer: req.user.id, bidAmount });
        await newBid.save();

        await sendNotification(caseExists.client, `A lawyer bid ${bidAmount} on your case (ID: ${caseId})`, 'Bid');


        res.status(201).json(newBid);
    } catch (error) {
        console.error('❌ Bid Placement Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getCaseBids = async (req, res) => {
    try {
        const { caseId } = req.params;
        const bids = await Bid.find({ case: caseId }).populate('lawyer', 'username email');
        res.json(bids);
    } catch (error) {
        console.error('❌ Fetch Bids Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
// import Bid from '../models/Bid.js';
// import Case from '../models/Case.js';
// import { sendNotification } from '../utils/notify.js';

// export const placeBid = async (req, res) => {
//     try {
//         const { caseId, bidAmount } = req.body;
//         if (!caseId || !bidAmount) return res.status(400).json({ message: "Case ID and bid amount are required" });

//         const caseExists = await Case.findById(caseId);
//         if (!caseExists) return res.status(404).json({ message: "Case not found" });

//         const newBid = new Bid({ case: caseId, lawyer: req.user.id, bidAmount });
//         await newBid.save();

//         await sendNotification(caseExists.client, `A lawyer bid ${bidAmount} on your case (ID: ${caseId})`, 'Bid');

//         res.status(201).json(newBid);
//     } catch (error) {
//         console.error('❌ Bid Placement Error:', error.message);
//         res.status(500).json({ message: "Server Error", error: error.message });
//     }
// };