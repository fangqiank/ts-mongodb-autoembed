import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => {
      return (
        <main className="page-wrap px-4 py-20 text-center">
          <h1 className="display-title text-4xl font-bold text-(--sea-ink)">404</h1>
          <p className="mt-2 text-(--sea-ink-soft)">Page not found.</p>
        </main>
      )
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
