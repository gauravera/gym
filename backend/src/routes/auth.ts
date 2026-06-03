import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../lib/db';
import { hashPassword, verifyPassword, signJWT } from '../lib/auth';
import { authenticateToken, RequestWithUser } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: any, res: Response): Promise<any> => {
  try {
    const { gymName, gymSlug, ownerName, ownerEmail, ownerPassword } = req.body;

    if (!gymName || !gymSlug || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check slug uniqueness
    const existingGym = await db.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (existingGym) {
      return res.status(400).json({ error: 'Gym slug already taken' });
    }

    // Check user uniqueness
    const existingUser = await db.gymUser.findUnique({
      where: { email: ownerEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Owner email already registered' });
    }

    const passwordHash = hashPassword(ownerPassword);

    // Create Gym, Owner User, ChatbotSettings, PaymentSettings, and default plans in a transaction
    const result = await db.$transaction(async (tx: any) => {
      const gym = await tx.gym.create({
        data: {
          name: gymName,
          slug: gymSlug.toLowerCase(),
        },
      });

      const user = await tx.gymUser.create({
        data: {
          name: ownerName,
          email: ownerEmail,
          passwordHash,
          role: 'OWNER',
          gymId: gym.id,
        },
      });

      await tx.chatbotSettings.create({
        data: {
          gymId: gym.id,
          welcomeMessage: `Welcome to ${gymName}!\n\n1. My Membership\n2. Renew Membership\n3. View Plans\n4. Contact Gym\n5. Offers`,
        },
      });

      await tx.paymentSettings.create({
        data: {
          gymId: gym.id,
        },
      });

      // Default plans
      await tx.membershipPlan.createMany({
        data: [
          { name: 'Monthly Basic', price: 999, durationDays: 30, gymId: gym.id, description: 'Access to Gym during normal timings.' },
          { name: 'Quarterly Pro', price: 2499, durationDays: 90, gymId: gym.id, description: 'Save on 3-month subscription.' },
          { name: 'Annual Elite', price: 7999, durationDays: 365, gymId: gym.id, description: 'Full access for 1 year + 2 personal trainer sessions.' },
        ],
      });

      await tx.auditLog.create({
        data: {
          action: 'GYM_REGISTER',
          details: `Gym ${gymName} registered by ${ownerName} (${ownerEmail})`,
          gymId: gym.id,
          userId: user.id,
        },
      });

      return { gym, user };
    });

    // Auto log in the user on registration
    const payload = {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role as any,
      gymId: result.user.gymId,
    };
    const token = signJWT(payload);

    const isSecure = process.env.NODE_ENV === 'production' || 
                     req.secure || 
                     req.headers['x-forwarded-proto'] === 'https' ||
                     (req.headers['host'] && req.headers['host'].includes('ngrok'));

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: !!isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
      path: '/',
    });

    return res.status(201).json({
      success: true,
      gym: result.gym,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: any, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.gymUser.findUnique({
      where: { email },
      include: { gym: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      gymId: user.gymId,
    };

    const token = signJWT(payload);

    const isSecure = process.env.NODE_ENV === 'production' || 
                     req.secure || 
                     req.headers['x-forwarded-proto'] === 'https' ||
                     (req.headers['host'] && req.headers['host'].includes('ngrok'));

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: !!isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
      path: '/',
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        gym: user.gym ? { id: user.gym.id, name: user.gym.name, slug: user.gym.slug } : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: any, res: Response) => {
  res.clearCookie('auth_token', { path: '/' });
  if (req.headers['content-type'] === 'application/x-www-form-urlencoded' || req.accepts('html')) {
    return res.redirect('/login');
  }
  return res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.gymUser.findUnique({
      where: { id: req.user.userId },
      include: { gym: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        gym: user.gym ? { id: user.gym.id, name: user.gym.name, slug: user.gym.slug } : null,
      },
    });
  } catch (error) {
    console.error('Me auth checking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ================= FACEBOOK COMPLIANCE WEBHOOKS ================= */

/**
 * Parses and validates Meta's signed_request payload
 */
function parseSignedRequest(signedRequest: string, appSecret: string): any {
  const parts = signedRequest.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid signed request format');
  }
  const [encodedSig, payloadStr] = parts;

  // Base64url decode signature and payload
  const sig = Buffer.from(encodedSig, 'base64url').toString('hex');
  const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(payloadStr)
    .digest('hex');

  if (sig !== expectedSig) {
    throw new Error('Invalid signature');
  }

  return payload;
}

// POST /api/auth/facebook/deauthorize
router.post('/facebook/deauthorize', async (req: any, res: Response): Promise<any> => {
  try {
    const { signed_request } = req.body;
    if (!signed_request) {
      return res.status(400).json({ error: 'Missing signed_request parameter' });
    }

    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      console.warn('[Facebook Deauthorize] App Secret not configured. Skipping signature verification.');
    } else {
      try {
        const payload = parseSignedRequest(signed_request, appSecret);
        console.log('[Facebook Deauthorize] Valid request received for User ID:', payload.user_id);
      } catch (err: any) {
        console.error('[Facebook Deauthorize] Signature verification failed:', err.message);
        return res.status(400).json({ error: 'Signature verification failed' });
      }
    }

    return res.json({ success: true, message: 'Deauthorization logged successfully.' });
  } catch (error) {
    console.error('Facebook deauthorize error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/facebook/delete-data
router.post('/facebook/delete-data', async (req: any, res: Response): Promise<any> => {
  try {
    const { signed_request } = req.body;
    if (!signed_request) {
      return res.status(400).json({ error: 'Missing signed_request parameter' });
    }

    let userId = 'unknown';
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      console.warn('[Facebook Data Deletion] App Secret not configured. Skipping signature verification.');
    } else {
      try {
        const payload = parseSignedRequest(signed_request, appSecret);
        userId = payload.user_id || 'unknown';
        console.log('[Facebook Data Deletion] Valid deletion request for User ID:', userId);
      } catch (err: any) {
        console.error('[Facebook Data Deletion] Signature verification failed:', err.message);
        return res.status(400).json({ error: 'Signature verification failed' });
      }
    }

    const confirmationCode = `del_${userId}_${Date.now()}`;
    const statusUrl = `https://fitwa.vercel.app/privacy?status=${confirmationCode}`;

    return res.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error('Facebook data deletion error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
