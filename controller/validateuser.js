const { isValidEmailFormat } = require('../utils/emailvalidator');
const User = require('../models/surveyuser.model'); // import your model

const validateVisitor = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmailFormat(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      return res.status(200).json({ success: true, message: 'Visitor validated' });
    } else {
      return res.status(403).json({ success: false, message: 'Email not recognized' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { validateVisitor };
