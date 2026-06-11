import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-gym-saas-token-key-2026';

/**
 * Hashes a plain text password.
 */
export function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

/**
 * Verifies a plain text password against a hash.
 */
export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

/**
 * Signs a JWT payload.
 */
export function signJWT(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verifies and decodes a JWT token.
 */
export function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
