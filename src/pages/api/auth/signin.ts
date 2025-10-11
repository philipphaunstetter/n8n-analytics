import { NextApiRequest, NextApiResponse } from 'next';
import { getConfigManager } from '../../../lib/config-manager';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const config = getConfigManager();
    
    // First, try to authenticate against database admin user
    const adminEmail = await config.get('setup.admin_email');
    const adminName = await config.get('setup.admin_name');
    const adminPasswordHash = await config.get('setup.admin_password_hash');
    
    if (adminEmail && adminPasswordHash && email.toLowerCase() === adminEmail.toLowerCase()) {
      // Check password hash
      const inputHash = crypto.createHash('sha256').update(password).digest('hex');
      
      if (inputHash === adminPasswordHash) {
        return res.status(200).json({
          success: true,
          user: {
            id: 'admin-001',
            email: adminEmail,
            name: adminName || 'Admin User',
            role: 'admin'
          }
        });
      }
    }

    // Fallback to hardcoded dev users for development/testing
    if (process.env.NODE_ENV === 'development') {
      const DEV_USERS: Record<string, { password: string; user: any }> = {
        'dev@example.com': {
          password: 'dev123',
          user: {
            id: 'dev-001',
            email: 'dev@example.com',
            name: 'Dev User',
            role: 'developer'
          }
        },
        'admin@example.com': {
          password: 'admin123',
          user: {
            id: 'admin-002',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin'
          }
        }
      };

      const userEntry = DEV_USERS[email.toLowerCase()];
      if (userEntry && userEntry.password === password) {
        return res.status(200).json({
          success: true,
          user: userEntry.user
        });
      }
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}