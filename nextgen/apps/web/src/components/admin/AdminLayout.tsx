import { Outlet } from 'react-router-dom';
import AdminNav from '../../app/(admin)/admin/_components/AdminNav';

/**
 * Frame of the admin area: sidebar with the admin navigation, pages on the
 * right. Ported from src/app/(admin)/admin/layout.tsx, a server component
 * that also checks the role before rendering; here that check is the
 * RequireAdmin guard on the route (router.tsx), and every admin route of the
 * API checks the role again on its own.
 */
export function AdminLayout() {
    return (
        <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-56 min-h-screen bg-zinc-900 border-r border-zinc-800 py-6 px-3 sticky top-0 h-screen">
                <div className="mb-8 px-3">
                    <span className="text-xs font-semibold tracking-widest uppercase text-zinc-500">
                        Admin Panel
                    </span>
                    <div className="text-lg font-bold text-white mt-1">motonui</div>
                </div>

                <AdminNav />
            </aside>

            {/* Main content */}
            <main className="flex-1 flex flex-col">
                <Outlet />
            </main>
        </div>
    );
}
