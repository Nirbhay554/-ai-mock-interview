const BANNED_PHRASES = [
  'ignore previous instructions',
  'ignore all instructions',
  'system prompt',
  'jailbreak',
  'pretend you are',
  'act as if',
  'disregard your',
  'forget your instructions',
  'new instructions:',
  'override instructions',
];

const MAX_ANSWER_LENGTH = 1500; // chars

const sanitizeInput = (req, res, next) => {
  const { answer } = req.body;

  if (!answer || typeof answer !== 'string') {
    return res.status(400).json({ error: 'Answer is required' });
  }

  const lower = answer.toLowerCase();
  const hasInjection = BANNED_PHRASES.some((phrase) => lower.includes(phrase));

  if (hasInjection) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }

  if (answer.length > MAX_ANSWER_LENGTH) {
    return res.status(400).json({
      error: `Answer too long. Max ${MAX_ANSWER_LENGTH} characters allowed.`,
    });
  }

  // Attach cleaned version to request
  req.body.answer = answer.trim();
  next();
};

export default sanitizeInput;
