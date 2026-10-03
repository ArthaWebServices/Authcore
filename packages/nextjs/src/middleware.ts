export interface AuthMiddlewareConfig {
  publicRoutes?: (string | RegExp)[];
  loginUrl?: string;
  authCoreUrl?: string;
}

export function authMiddleware(config: AuthMiddlewareConfig = {}) {
  const {
    publicRoutes = ['/login', '/register', '/api/auth'],
    loginUrl = '/login',
  } = config;

  return async function middleware(req: any) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    const isPublic = publicRoutes.some((route) => {
      if (typeof route === 'string') {
        return pathname === route || pathname.startsWith(route + '/');
      }
      return route.test(pathname);
    });

    if (isPublic) {
      return;
    }

    const token = req.cookies?.get('access_token')?.value || req.cookies?.get('refresh_token')?.value;
    if (!token) {
      const redirectUrl = new URL(loginUrl, req.url);
      redirectUrl.searchParams.set('redirect_url', pathname);
      return Response.redirect(redirectUrl);
    }
  };
}
