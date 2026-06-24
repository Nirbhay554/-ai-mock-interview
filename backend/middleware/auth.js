import supabase from '../config/supabase.js';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user; // { id, email, user_metadata: { name, avatar_url } }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Auth check failed' });
  }
};

export default authenticate;
