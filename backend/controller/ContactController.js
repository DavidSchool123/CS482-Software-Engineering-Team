
const ContactDao = require('../model/ContactDao');

exports.submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (
      [name, email, subject, message].some(
        (value) => typeof value !== 'string' || !value.trim()
      )
    ) {
      return res.status(400).json({
        message: 'All fields are required.',
      });
    }

    // Validate character limits
    if (
      name.trim().length > 100 ||
      email.trim().length > 254 ||
      subject.trim().length > 150 ||
      message.trim().length > 2000
    ) {
      return res.status(400).json({
        message: 'One or more fields exceed the maximum allowed length.',
      });
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({
        message: 'Please enter a valid email address.',
      });
    }

    // Save the message to MongoDB
    const contact = await ContactDao.createContact({
      Name: name.trim(),
      Email: email.trim(),
      Subject: subject.trim(),
      Message: message.trim(),
    });

    return res.status(201).json({
      message: 'Your message has been submitted successfully.',
      id: contact._id,
    });
  } catch (error) {
    console.error('Error submitting contact message:', error);

    return res.status(500).json({
      message: 'Unable to submit your message. Please try again.',
    });
  }
};
