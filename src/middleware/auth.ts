import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any).user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req.session as any).user;
    if (!user || !roles.includes(user.roleId === '3' ? 'worker' : user.roleId === '2' ? 'clerk' : user.roleId === '1' ? 'admin' : '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
