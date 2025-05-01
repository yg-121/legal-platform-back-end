import Bid from '../models/Bid.js';
import Case from '../models/Case.js';
import { sendNotification } from '../utils/notify.js';

export const createBid = async (req, res) => {
    try {
        const { case: caseId, amount, comment } = req.body;
        const lawyer = req.user.id;

        if (!caseId || !amount) {
            return res.status(400).json({ message: "Case ID and amount are required" });
        }
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: "Amount must be a positive number" });
        }
        if (comment && comment.length > 200) {
            return res.status(400).json({ message: "Comment must be under 200 characters" });
        }

        const caseExists = await Case.findById(caseId);
        if (!caseExists) {
            return res.status(404).json({ message: "Case not found" });
        }
        if (caseExists.status !== 'Posted') {
            return res.status(400).json({ message: "Cannot bid on a non-posted case" });
        }
        if (await Bid.findOne({ lawyer, case: caseId })) {
            return res.status(400).json({ message: "You’ve already bid on this case" });
        }

        const bid = new Bid({ lawyer, case: caseId, amount, comment });
        await bid.save();

        const clientId = caseExists.client;
        await sendNotification(clientId, `A lawyer has bid ${amount} ETB on your case: "${caseExists.description}"`, 'Bid');

        res.status(201).json(bid);
    } catch (error) {
        console.error('❌ Bid Creation Error:', error.message);
        res.status(500).json({ message: "Failed to create bid", error: error.message });
    }
};

export const getCaseBids = async (req, res) => {
    try {
        const { caseId } = req.params;
        const bids = await Bid.find({ case: caseId })
        .populate('lawyer', 'username averageRating ratingCount email');
        res.json(bids);
    } catch (error) {
        console.error('❌ Fetch Case Bids Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const acceptBid = async (req, res) => {
    try {
        const { bidId } = req.params;
        const clientId = req.user.id;

        const bid = await Bid.findById(bidId).populate('case');
        if (!bid) {
            return res.status(404).json({ message: "Bid not found" });
        }

        const caseData = bid.case;
        if (caseData.client.toString() !== clientId) {
            return res.status(403).json({ message: "You can only accept bids on your own cases" });
        }
        if (caseData.status !== 'Posted') {
            return res.status(400).json({ message: "Case is no longer open for bids" });
        }

        // Update bid status
        bid.status = 'Accepted';
        await bid.save();

        // Update case with winning bid and assigned lawyer
        caseData.status = 'Assigned';
        caseData.winning_bid = bidId;
        caseData.assigned_lawyer = bid.lawyer;
        await caseData.save();

        // Notify the lawyer
        const lawyerId = bid.lawyer;
        const notificationMessage = `Your bid of ${bid.amount} ETB on case "${caseData.description}" has been accepted!`;
        await sendNotification(lawyerId, notificationMessage, 'BidAccepted');

        res.json({ message: "Bid accepted", bid, case: caseData });
    } catch (error) {
        console.error('❌ Bid Acceptance Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
export const getMyBids = async (req, res) => {
    try {
      const bids = await Bid.find({ lawyer: req.user.id })
        .populate('case', 'description category status')
        .populate('lawyer', 'username email');
      res.json({ message: 'My bids fetched', bids });
    } catch (error) {
      console.error('❌ Fetch My Bids Error:', error.message);
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  };